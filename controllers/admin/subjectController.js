import asyncHandler from 'express-async-handler';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Create a new subject
 * @route   POST /api/admin/subjects
 * @access  Private/Admin
 */
export const createSubject = asyncHandler(async (req, res, next) => {
  const { subjectName, subjectCode, semester, creditHours, academicSession } = req.body;

  const existingSubject = await Subject.findOne({ subjectCode });
  if (existingSubject) {
    return next(new ApiError(400, `Subject with code ${subjectCode} already exists`));
  }

  const subject = await Subject.create({
    subjectName,
    subjectCode,
    semester,
    creditHours,
    academicSession,
  });

  await logAdminAction(req, `Admin created subject: ${subject.subjectName} (${subject.subjectCode})`, 'subject');

  res.status(201).json(new ApiResponse(201, subject, 'Subject created successfully'));
});

/**
 * @desc    Assign a teacher to a subject
 * @route   PATCH /api/admin/subjects/:id/assign-teacher
 * @access  Private/Admin
 */
export const assignTeacherToSubject = asyncHandler(async (req, res, next) => {
  const { teacherId } = req.body; // ObjectId of Teacher

  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    return next(new ApiError(404, 'Subject not found'));
  }

  const teacher = await Teacher.findById(teacherId).populate('userId', 'name');
  if (!teacher) {
    return next(new ApiError(404, 'Teacher not found'));
  }

  // 1. Update Subject assignedTeacher
  subject.assignedTeacher = teacher._id;
  await subject.save();

  // 2. Add subject to Teacher's subjects array if not already present
  if (!teacher.subjects.includes(subject._id)) {
    teacher.subjects.push(subject._id);
    await teacher.save();
  }

  await logAdminAction(
    req,
    `Admin assigned teacher ${teacher.userId.name} to subject ${subject.subjectName}`,
    'subject',
    teacher.userId._id
  );

  res.status(200).json(
    new ApiResponse(
      200,
      {
        subjectId: subject._id,
        subjectName: subject.subjectName,
        assignedTeacherName: teacher.userId.name,
      },
      'Teacher assigned to subject successfully'
    )
  );
});

/**
 * @desc    Get all subjects
 * @route   GET /api/admin/subjects
 * @access  Private/Admin
 */
export const getSubjects = asyncHandler(async (req, res, next) => {
  const { semester, session } = req.query;
  const query = {};
  if (semester) query.semester = Number(semester);
  if (session) query.academicSession = session;

  const subjects = await Subject.find(query)
    .populate({
      path: 'assignedTeacher',
      populate: { path: 'userId', select: 'name' }
    })
    .lean();

  res.status(200).json(new ApiResponse(200, subjects, 'Subjects retrieved successfully'));
});

/**
 * @desc    Update a subject
 * @route   PUT /api/admin/subjects/:id
 * @access  Private/Admin
 */
export const updateSubject = asyncHandler(async (req, res, next) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    return next(new ApiError(404, 'Subject not found'));
  }

  const { subjectName, subjectCode, semester, creditHours, academicSession } = req.body;

  if (subjectName) subject.subjectName = subjectName;
  if (subjectCode) subject.subjectCode = subjectCode;
  if (semester) subject.semester = Number(semester);
  if (creditHours) subject.creditHours = Number(creditHours);
  if (academicSession) subject.academicSession = academicSession;

  await subject.save();

  await logAdminAction(req, `Admin updated subject: ${subject.subjectName} (${subject.subjectCode})`, 'subject');

  res.status(200).json(new ApiResponse(200, subject, 'Subject updated successfully'));
});

/**
 * @desc    Delete a subject
 * @route   DELETE /api/admin/subjects/:id
 * @access  Private/Admin
 */
export const deleteSubject = asyncHandler(async (req, res, next) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) {
    return next(new ApiError(404, 'Subject not found'));
  }

  // Remove from teacher subjects array if assigned
  if (subject.assignedTeacher) {
    const teacher = await Teacher.findById(subject.assignedTeacher);
    if (teacher) {
      teacher.subjects = teacher.subjects.filter(subId => subId.toString() !== subject._id.toString());
      await teacher.save();
    }
  }

  await subject.deleteOne();

  await logAdminAction(req, `Admin deleted subject: ${subject.subjectName} (${subject.subjectCode})`, 'subject');

  res.status(200).json(new ApiResponse(200, {}, 'Subject deleted successfully'));
});

