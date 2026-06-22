import asyncHandler from 'express-async-handler';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import Student from '../../models/Student.js';
import Complaint from '../../models/Complaint.js';
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
 * @desc    View complaints from students enrolled in teacher's assigned subjects
 * @route   GET /api/teacher/complaints
 * @access  Private/Teacher
 */
export const getComplaints = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // Find all subjects assigned to teacher
  const subjects = await Subject.find({ assignedTeacher: teacher._id }).lean();

  // Map to distinct semester/academicSession pairs to identify which students this teacher covers
  const orConditions = subjects.map(s => ({
    semester: s.semester,
    academicSession: s.academicSession
  }));

  if (orConditions.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], 'Teacher is not assigned to any subjects. Returning zero complaints.'));
  }

  // Find all active students in these semesters & sessions
  const students = await Student.find({
    $or: orConditions,
    currentStatus: 'active'
  }).lean();
  const studentIds = students.map(s => s._id);

  // Query complaints sent by these students
  const query = { student: { $in: studentIds } };
  
  // Optional status filter
  if (req.query.status) {
    if (!['pending', 'resolved'].includes(req.query.status)) {
      return next(new ApiError(400, 'Status filter must be pending or resolved.'));
    }
    query.status = req.query.status;
  }

  const complaints = await Complaint.find(query)
    .sort({ createdAt: -1 })
    .populate('student', 'name rollNumber registrationNumber semester academicSession')
    .lean();

  res.status(200).json(new ApiResponse(200, complaints, 'Complaints retrieved successfully'));
});

/**
 * @desc    Reply to Student Complaint
 * @route   POST /api/teacher/complaints/:id/reply
 * @access  Private/Teacher
 */
export const replyComplaint = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { reply } = req.body;

  // 1. Find complaint
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    return next(new ApiError(404, 'Complaint record not found.'));
  }

  // 2. Verify student who lodged complaint belongs to teacher's class roster
  const student = await Student.findById(complaint.student).lean();
  if (!student) {
    return next(new ApiError(404, 'Student associated with this complaint does not exist.'));
  }

  // Check if teacher is assigned to any subject taught to this student's semester/session
  const assignedSubject = await Subject.findOne({
    assignedTeacher: teacher._id,
    semester: student.semester,
    academicSession: student.academicSession
  }).lean();

  if (!assignedSubject) {
    return next(new ApiError(403, 'You are not authorized to reply to this complaint as the student is not in your classes.'));
  }

  // 3. Save reply and resolve status
  complaint.reply = reply;
  complaint.status = 'resolved';
  complaint.repliedBy = req.user._id; // User document reference
  complaint.repliedAt = Date.now();

  await complaint.save();

  // 4. Notify Student
  await Notification.create({
    receiver: student.userId,
    title: 'Complaint Replied',
    message: `Your complaint has been replied to by Prof. ${req.user.name}. Status: Resolved.`,
    type: 'complaint'
  });

  // 5. Log Audit
  await logAdminAction(
    req,
    `Teacher replied to and resolved complaint from student ${student.name}`,
    'complaint',
    student.userId
  );

  res.status(200).json(new ApiResponse(200, complaint, 'Complaint replied and resolved successfully'));
});
