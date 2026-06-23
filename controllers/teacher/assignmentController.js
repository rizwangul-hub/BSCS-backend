import asyncHandler from 'express-async-handler';
import cloudinary from '../../config/cloudinary.js';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import Student from '../../models/Student.js';
import Assignment from '../../models/Assignment.js';
import Submission from '../../models/Submission.js';
import Notification from '../../models/Notification.js';
import { logAdminAction } from '../../utils/auditLogger.js';
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
 * Helper to stream buffer file to Cloudinary with options
 */
const uploadPdfToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'gpgc_assignments', resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * @desc    Upload Assignment (Single PDF)
 * @route   POST /api/teacher/assignments
 * @access  Private/Teacher
 */
export const createAssignment = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { title, description, deadline, subject: subjectId } = req.body;

  // 1. Verify subject is assigned to this teacher
  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to create assignments for this subject.'));
  }

  // 2. Upload PDF to Cloudinary if provided
  let pdfUrl = '';
  if (req.file) {
    // Basic file type validation (PDF check)
    if (req.file.mimetype !== 'application/pdf') {
      return next(new ApiError(400, 'Only PDF documents are allowed for assignment uploads.'));
    }
    try {
      pdfUrl = await uploadPdfToCloudinary(req.file.buffer);
    } catch (err) {
      return next(new ApiError(500, `Cloudinary Upload Error: ${err.message}`));
    }
  }

  // 3. Create assignment in database
  const assignment = await Assignment.create({
    title,
    description,
    pdfFile: pdfUrl,
    deadline,
    subject: subjectId,
    teacher: teacher._id
  });

  // 4. Notify all active students enrolled in this subject's semester/session
  const students = await Student.find({
    semester: subject.semester,
    academicSession: subject.academicSession,
    currentStatus: 'active'
  }).lean();

  for (const student of students) {
    await Notification.create({
      receiver: student.userId,
      title: 'New Assignment Uploaded',
      message: `A new assignment "${title}" has been uploaded for ${subject.subjectName}.`,
      type: 'notice'
    });
  }

  // 5. Log Audit
  await logAdminAction(req, `Teacher uploaded assignment: "${title}" for subject ${subject.subjectName}`, 'assignment');

  res.status(201).json(new ApiResponse(201, assignment, 'Assignment uploaded successfully'));
});

/**
 * @desc    Get assignments for subjects assigned to teacher
 * @route   GET /api/teacher/assignments
 * @access  Private/Teacher
 */
export const getAssignments = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // Find all subjects assigned to teacher
  const subjects = await Subject.find({ assignedTeacher: teacher._id }).lean();
  const subjectIds = subjects.map(s => s._id);

  // Fetch all assignments linked to these subjects
  const assignments = await Assignment.find({ subject: { $in: subjectIds } })
    .sort({ createdAt: -1 })
    .populate('subject', 'subjectName subjectCode semester academicSession')
    .lean();

  res.status(200).json(new ApiResponse(200, assignments, 'Assignments retrieved successfully'));
});

/**
 * @desc    Update Assignment
 * @route   PUT /api/teacher/assignments/:id
 * @access  Private/Teacher
 */
export const updateAssignment = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { title, description, deadline } = req.body;

  // 1. Find assignment
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) {
    return next(new ApiError(404, 'Assignment record not found.'));
  }

  // 2. Verify ownership
  if (assignment.teacher.toString() !== teacher._id.toString()) {
    return next(new ApiError(403, 'You are not authorized to update this assignment.'));
  }

  // 3. Upload new PDF if provided
  if (req.file) {
    if (req.file.mimetype !== 'application/pdf') {
      return next(new ApiError(400, 'Only PDF documents are allowed for assignment uploads.'));
    }
    try {
      assignment.pdfFile = await uploadPdfToCloudinary(req.file.buffer);
    } catch (err) {
      return next(new ApiError(500, `Cloudinary Upload Error: ${err.message}`));
    }
  }

  // 4. Update other fields
  if (title) assignment.title = title;
  if (description !== undefined) assignment.description = description;
  if (deadline) assignment.deadline = deadline;

  await assignment.save();

  const subject = await Subject.findById(assignment.subject).lean();

  // 5. Log Audit
  await logAdminAction(req, `Teacher updated assignment: "${assignment.title}" for subject ${subject?.subjectName || 'N/A'}`, 'assignment');

  res.status(200).json(new ApiResponse(200, assignment, 'Assignment updated successfully'));
});

/**
 * @desc    Delete Assignment
 * @route   DELETE /api/teacher/assignments/:id
 * @access  Private/Teacher
 */
export const deleteAssignment = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // 1. Find assignment
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) {
    return next(new ApiError(404, 'Assignment record not found.'));
  }

  // 2. Verify ownership
  if (assignment.teacher.toString() !== teacher._id.toString()) {
    return next(new ApiError(403, 'You are not authorized to delete this assignment.'));
  }

  const subject = await Subject.findById(assignment.subject).lean();

  // 3. Delete assignment
  await Assignment.deleteOne({ _id: req.params.id });

  // 4. Log Audit
  await logAdminAction(req, `Teacher deleted assignment: "${assignment.title}" from subject ${subject?.subjectName || 'N/A'}`, 'assignment');

  res.status(200).json(new ApiResponse(200, {}, 'Assignment deleted successfully'));
});

/**
 * @desc    Get student submissions for an assignment
 * @route   GET /api/teacher/assignments/:id/submissions
 * @access  Private/Teacher
 */
export const getAssignmentSubmissions = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const assignmentId = req.params.id;

  const assignment = await Assignment.findById(assignmentId).lean();
  if (!assignment) {
    return next(new ApiError(404, 'Assignment not found.'));
  }

  // Verify ownership of the subject
  const subject = await Subject.findOne({ _id: assignment.subject, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to view submissions for this subject.'));
  }

  // Fetch active students enrolled in this subject's semester and session
  const students = await Student.find({
    semester: subject.semester,
    academicSession: subject.academicSession,
    currentStatus: 'active'
  }).lean();

  // Fetch all student submissions for this assignment
  const submissions = await Submission.find({ assignment: assignmentId }).lean();

  const submissionMap = {};
  submissions.forEach(sub => {
    submissionMap[sub.student.toString()] = sub;
  });

  const roster = students.map(student => {
    const sub = submissionMap[student._id.toString()];
    return {
      student: {
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        registrationNumber: student.registrationNumber
      },
      submitted: !!sub,
      submittedAt: sub ? new Date(sub.submittedAt).toLocaleString() : '-',
      fileUrl: sub?.fileUrl || null,
      marks: sub?.marks !== null && sub?.marks !== undefined ? sub.marks : '',
      feedback: sub?.feedback || '',
      submissionId: sub?._id || null,
      isGraded: sub?.status === 'graded'
    };
  });

  res.status(200).json(new ApiResponse(200, roster, 'Submissions retrieved successfully'));
});

/**
 * @desc    Grade a student submission
 * @route   PUT /api/teacher/submissions/:id/grade
 * @access  Private/Teacher
 */
export const gradeSubmission = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { marks, feedback } = req.body;

  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    return next(new ApiError(404, 'Submission record not found.'));
  }

  // Verify authorization via assignment subject
  const assignment = await Assignment.findById(submission.assignment).lean();
  const subject = await Subject.findOne({ _id: assignment.subject, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to grade submissions for this subject.'));
  }

  submission.marks = marks;
  submission.feedback = feedback || '';
  submission.status = 'graded';
  submission.gradedBy = teacher._id;
  submission.gradedAt = new Date();

  await submission.save();

  // Create notification for the student
  const studentProfile = await Student.findById(submission.student).lean();
  if (studentProfile) {
    await Notification.create({
      receiver: studentProfile.userId,
      title: 'Assignment Graded',
      message: `Your submission for "${assignment.title}" has been graded. Marks: ${marks}/10`,
      type: 'notice'
    });
  }

  // Log Audit
  await logAdminAction(req, `Teacher graded submission for student ${studentProfile?.name || 'N/A'} in assignment "${assignment.title}"`, 'assignment');

  res.status(200).json(new ApiResponse(200, submission, 'Submission graded successfully'));
});
