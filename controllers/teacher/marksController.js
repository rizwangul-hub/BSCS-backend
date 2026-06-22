import asyncHandler from 'express-async-handler';
import xlsx from 'xlsx';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import Student from '../../models/Student.js';
import Marks from '../../models/Marks.js';
import Notification from '../../models/Notification.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import { parseAndSaveExcelMarks } from '../../services/teacher/marksService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Helper to fetch teacher profile
 */
const getTeacherProfile = async (userId) => {
  const teacher = await Teacher.findOne({ userId }).lean();
  if (!teacher) {
    throw new ApiError(404, 'Teacher profile not found.');
  }
  return teacher;
};

/**
 * @desc    Add Marks (Single Student)
 * @route   POST /api/teacher/marks
 * @access  Private/Teacher
 */
export const addMarks = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const {
    student: studentId,
    subject: subjectId,
    semester,
    midMarks,
    presentation,
    test1,
    test2,
    assignment,
    quiz,
    attendanceMarks
  } = req.body;

  // 1. Verify teacher is assigned to subject
  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to upload marks for this subject.'));
  }

  // 2. Verify student exists and matches semester/session
  const student = await Student.findOne({ _id: studentId, semester: subject.semester, academicSession: subject.academicSession }).lean();
  if (!student) {
    return next(new ApiError(404, 'Student not found in this subject class roster.'));
  }

  // 3. Prevent duplicate marks record
  const existingMarks = await Marks.findOne({ student: studentId, subject: subjectId }).lean();
  if (existingMarks) {
    return next(new ApiError(400, 'Marks record already exists for this student and subject.'));
  }

  // 4. Save record (Grade, sessionalTotal, grandTotal and percentage auto calculated pre-save)
  const marks = await Marks.create({
    student: studentId,
    subject: subjectId,
    teacher: teacher._id,
    semester,
    midMarks,
    presentation,
    test1,
    test2,
    assignment,
    quiz,
    attendanceMarks
  });

  // 5. Notify Student
  await Notification.create({
    receiver: student.userId,
    title: 'Marks Uploaded',
    message: `Your marks for subject ${subject.subjectName} have been uploaded. Grade: ${marks.grade}`,
    type: 'marks'
  });

  // 6. Log Audit
  await logAdminAction(req, `Teacher uploaded marks for student ${student.name} in subject ${subject.subjectName} (Grade: ${marks.grade})`, 'marks', student.userId);

  res.status(201).json(new ApiResponse(201, marks, 'Marks added successfully'));
});

/**
 * @desc    Update Marks
 * @route   PUT /api/teacher/marks/:id
 * @access  Private/Teacher
 */
export const updateMarks = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const {
    midMarks,
    presentation,
    test1,
    test2,
    assignment,
    quiz,
    attendanceMarks
  } = req.body;

  // 1. Find marks record
  const marks = await Marks.findById(req.params.id);
  if (!marks) {
    return next(new ApiError(404, 'Marks record not found.'));
  }

  // 2. Verify ownership
  if (marks.teacher.toString() !== teacher._id.toString()) {
    return next(new ApiError(403, 'You are not authorized to update these marks.'));
  }

  // 3. Update fields
  if (midMarks !== undefined) marks.midMarks = midMarks;
  if (presentation !== undefined) marks.presentation = presentation;
  if (test1 !== undefined) marks.test1 = test1;
  if (test2 !== undefined) marks.test2 = test2;
  if (assignment !== undefined) marks.assignment = assignment;
  if (quiz !== undefined) marks.quiz = quiz;
  if (attendanceMarks !== undefined) marks.attendanceMarks = attendanceMarks;

  // Save (triggers recalculations pre-save)
  await marks.save();

  const student = await Student.findById(marks.student).lean();
  const subject = await Subject.findById(marks.subject).lean();

  // 4. Notify Student
  if (student) {
    await Notification.create({
      receiver: student.userId,
      title: 'Marks Updated',
      message: `Your marks for subject ${subject?.subjectName || 'N/A'} have been updated. Grade: ${marks.grade}`,
      type: 'marks'
    });
  }

  // 5. Log Audit
  await logAdminAction(req, `Teacher updated marks for student ${student?.name || 'N/A'} in subject ${subject?.subjectName || 'N/A'} (Grade: ${marks.grade})`, 'marks', student?.userId);

  res.status(200).json(new ApiResponse(200, marks, 'Marks updated successfully'));
});

/**
 * @desc    Bulk Upload Marks via Excel
 * @route   POST /api/teacher/marks/upload-excel
 * @access  Private/Teacher
 */
export const uploadExcelMarks = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { subject: subjectId, semester } = req.body;

  if (!req.file) {
    return next(new ApiError(400, 'Please upload an Excel file.'));
  }

  if (!subjectId || !semester) {
    return next(new ApiError(400, 'Subject ID and semester are required.'));
  }

  const semNum = Number(semester);

  // 1. Verify subject is assigned to this teacher
  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to manage marks for this subject.'));
  }

  // 2. Parse Excel buffer & process rows
  const report = await parseAndSaveExcelMarks(
    req.file.buffer,
    subjectId,
    semNum,
    teacher._id,
    subject
  );

  // 3. Log Audit
  await logAdminAction(
    req,
    `Teacher uploaded excel marks sheet for subject ${subject.subjectName} (${report.successful.length} successes, ${report.failed.length} failures)`,
    'marks'
  );

  res.status(200).json(new ApiResponse(200, report, 'Excel marks uploaded and processed successfully'));
});

/**
 * @desc    Download Excel Marks Template
 * @route   GET /api/teacher/marks/template
 * @access  Private/Teacher
 */
export const downloadTemplate = asyncHandler(async (req, res, next) => {
  const headers = [
    {
      registrationNumber: 'REG-CS-101',
      midMarks: 25,
      presentation: 4,
      test1: 4,
      test2: 4,
      assignment: 4,
      quiz: 4,
      attendanceMarks: 5
    }
  ];

  const worksheet = xlsx.utils.json_to_sheet(headers);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Marks_Template');
  
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=Marks_Template.xlsx');
  res.status(200).send(buffer);
});

/**
 * @desc    Get all marks for a subject class roster
 * @route   GET /api/teacher/marks
 * @access  Private/Teacher
 */
export const getMarksForSubject = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { subject: subjectId } = req.query;

  if (!subjectId) {
    return next(new ApiError(400, 'Subject ID is required.'));
  }

  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to view marks for this subject.'));
  }

  const students = await Student.find({
    semester: subject.semester,
    academicSession: subject.academicSession,
    currentStatus: 'active'
  }).lean();

  const marksRecords = await Marks.find({ subject: subjectId }).lean();

  const studentMarksList = students.map((student) => {
    const studentMarks = marksRecords.find(
      (m) => m.student.toString() === student._id.toString()
    );
    return {
      student,
      marks: studentMarks || null
    };
  });

  res.status(200).json(new ApiResponse(200, studentMarksList, 'Marks retrieved successfully'));
});
