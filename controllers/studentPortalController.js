import asyncHandler from 'express-async-handler';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Attendance from '../models/Attendance.js';
import Marks from '../models/Marks.js';
import Teacher from '../models/Teacher.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Complaint from '../models/Complaint.js';
import Notice from '../models/Notice.js';
import Notification from '../models/Notification.js';
import Timetable from '../models/Timetable.js';
import User from '../models/User.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { v2 as cloudinary } from 'cloudinary';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve student record from logged-in user
// ─────────────────────────────────────────────────────────────────────────────
const getStudentRecord = async (userId, next) => {
  const student = await Student.findOne({ userId });
  if (!student) {
    next(new ApiError(404, 'Student profile not found.'));
    return null;
  }
  return student;
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get Student Dashboard data (attendance, marks, subjects, profile)
// @route   GET /api/student/dashboard
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentDashboardStats = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  // Active subjects for student's semester & session
  const subjects = await Subject.find({
    semester: student.semester,
    academicSession: student.academicSession,
  }).populate({
    path: 'assignedTeacher',
    populate: { path: 'userId', select: 'name' }
  });

  // Attendance records
  const attendanceRecords = await Attendance.find({ student: student._id })
    .populate('subject', 'subjectName subjectCode creditHours');

  let totalAttended = 0;
  let totalClassesCount = 0;
  attendanceRecords.forEach((rec) => {
    totalAttended += rec.attendedClasses || 0;
    totalClassesCount += rec.totalClasses || 0;
  });
  const overallPercentage =
    totalClassesCount > 0
      ? Math.round((totalAttended / totalClassesCount) * 10000) / 100
      : student.overallAttendancePercentage || 0;

  // Marks transcript
  const marksRecords = await Marks.find({ student: student._id })
    .populate('subject', 'subjectName subjectCode creditHours');

  res.status(200).json(
    new ApiResponse(200, {
      profile: student,
      semesterInfo: { semester: student.semester, academicSession: student.academicSession, subjects },
      attendanceSummary: { overallPercentage, records: attendanceRecords },
      marksSummary: marksRecords,
    }, 'Student dashboard metrics loaded successfully')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student marks transcript
// @route   GET /api/student/marks
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentMarks = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const marksRecords = await Marks.find({ student: student._id })
    .populate('subject', 'subjectName subjectCode creditHours')
    .lean();

  res.status(200).json(new ApiResponse(200, marksRecords, 'Marks fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student attendance summary
// @route   GET /api/student/attendance
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentAttendance = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const records = await Attendance.find({ student: student._id })
    .populate('subject', 'subjectName subjectCode creditHours')
    .lean();

  let totalAttended = 0;
  let totalClasses = 0;
  records.forEach((r) => {
    totalAttended += r.attendedClasses || 0;
    totalClasses += r.totalClasses || 0;
  });
  const overallPercentage =
    totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 10000) / 100 : 0;

  res.status(200).json(
    new ApiResponse(200, { overallPercentage, records }, 'Attendance fetched successfully')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student timetable (by semester)
// @route   GET /api/student/timetable
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentTimetable = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const slots = await Timetable.find({ semester: student.semester })
    .populate('subject', 'subjectName subjectCode academicSession')
    .populate({
      path: 'teacher',
      populate: { path: 'userId', select: 'name' },
    })
    .lean();

  // Filter slots where subject belongs to the student's active session
  const filteredSlots = slots.filter((slot) => {
    return slot.subject && slot.subject.academicSession === student.academicSession;
  });

  // Reshape teacher field for frontend convenience
  const reshaped = filteredSlots.map((slot) => ({
    ...slot,
    teacher: slot.teacher
      ? { ...slot.teacher, name: slot.teacher.userId?.name || '' }
      : null,
    room: slot.roomNumber,
  }));

  res.status(200).json(new ApiResponse(200, reshaped, 'Timetable fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get assignments for student's semester/subjects
// @route   GET /api/student/assignments
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentAssignments = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  // Get subjects matching student's semester & session
  const subjects = await Subject.find({
    semester: student.semester,
    academicSession: student.academicSession,
  }).select('_id').lean();

  const subjectIds = subjects.map((s) => s._id);

  const assignments = await Assignment.find({ subject: { $in: subjectIds } })
    .populate('subject', 'subjectName subjectCode')
    .populate({
      path: 'teacher',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ deadline: 1 })
    .lean();

  // Normalize field names for frontend (dueDate = deadline, attachmentUrl = pdfFile)
  const normalized = assignments.map((a) => ({
    ...a,
    dueDate: a.deadline,
    attachmentUrl: a.pdfFile || null,
    mySubmission: null, // Submission tracking requires a Submission model; placeholder
  }));

  res.status(200).json(new ApiResponse(200, normalized, 'Assignments fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit assignment (with optional file upload)
// @route   POST /api/student/assignments/:id/submit
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const submitAssignment = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return next(new ApiError(404, 'Assignment not found'));

  // Check for duplicate submission
  const existing = await Submission.findOne({ assignment: assignment._id, student: student._id });
  if (existing) return next(new ApiError(400, 'You have already submitted this assignment.'));

  // Upload file to Cloudinary if provided
  let fileUrl = '';
  if (req.file) {
    fileUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'gpgc_submissions', resource_type: 'auto' },
        (error, result) => (error ? reject(error) : resolve(result.secure_url))
      );
      stream.end(req.file.buffer);
    });
  }

  // Determine if submission is late
  const isLate = assignment.deadline && new Date() > new Date(assignment.deadline);

  const submission = await Submission.create({
    assignment: assignment._id,
    student: student._id,
    fileUrl,
    note: req.body.note || '',
    status: isLate ? 'late' : 'submitted',
  });

  res.status(201).json(
    new ApiResponse(201, submission, isLate ? 'Assignment submitted (marked as late).' : 'Assignment submitted successfully.')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student's own complaints
// @route   GET /api/student/complaints
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentComplaints = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const complaints = await Complaint.find({ student: student._id })
    .sort({ createdAt: -1 })
    .lean();

  // Normalize field names for frontend
  const normalized = complaints.map((c) => ({
    ...c,
    subject: c.message?.slice(0, 60) || 'Complaint', // use message as subject if no dedicated field
    description: c.message,
    category: 'Academic',
    adminResponse: c.reply || null,
  }));

  res.status(200).json(new ApiResponse(200, normalized, 'Complaints fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit a new complaint
// @route   POST /api/student/complaints
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const submitComplaint = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const { subject, description, category } = req.body;
  if (!description?.trim()) {
    return next(new ApiError(400, 'Complaint description is required'));
  }

  const complaint = await Complaint.create({
    student: student._id,
    subject: subject || 'General Complaint',
    category: category || 'Academic',
    message: description,
  });

  res.status(201).json(
    new ApiResponse(201, {
      ...complaint.toObject(),
      description: complaint.message,
      adminResponse: null,
    }, 'Complaint submitted successfully')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student's in-app notifications (unread first)
// @route   GET /api/student/notifications
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentNotifications = asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 20;
  const skip  = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ receiver: req.user._id })
      .sort({ isRead: 1, createdAt: -1 })   // unread first
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ receiver: req.user._id }),
  ]);

  // Mark fetched notifications as read
  const ids = notifications.filter((n) => !n.isRead).map((n) => n._id);
  if (ids.length > 0) {
    await Notification.updateMany({ _id: { $in: ids } }, { isRead: true });
  }

  res.status(200).json(
    new ApiResponse(200, { notifications, total, page, pages: Math.ceil(total / limit) }, 'Notifications fetched')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get notices visible to students
// @route   GET /api/student/notices  (also accessible at /api/notices)
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentNotices = asyncHandler(async (req, res) => {
  const notices = await Notice.find({
    targetAudience: { $in: ['students', 'all'] },
    $or: [
      { expiryDate: null },
      { expiryDate: { $gte: new Date() } },
    ],
  })
    .populate('postedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  // Normalize for frontend
  const normalized = notices.map((n) => ({
    ...n,
    content: n.description,
    priority: 'low',
    category: 'General',
  }));

  res.status(200).json(new ApiResponse(200, normalized, 'Notices fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get student profile
// @route   GET /api/student/profile
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentProfile = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({ userId: req.user._id })
    .populate('userId', 'name email mobileNumber')
    .lean();

  if (!student) return next(new ApiError(404, 'Student profile not found.'));

  // Merge User fields into student profile for convenience
  const profile = {
    ...student,
    name: student.userId?.name || student.name,
    email: student.userId?.email,
    mobileNumber: student.userId?.mobileNumber || student.mobile,
  };

  res.status(200).json(new ApiResponse(200, profile, 'Profile fetched successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update student profile (editable fields only)
// @route   PUT /api/student/profile
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const updateStudentProfile = asyncHandler(async (req, res, next) => {
  const student = await getStudentRecord(req.user._id, next);
  if (!student) return;

  const { name, email, mobileNumber, fatherName, address } = req.body;

  // Update User record for auth fields
  const userUpdates = {};
  if (name) userUpdates.name = name;
  if (email) userUpdates.email = email;
  if (mobileNumber) userUpdates.mobileNumber = mobileNumber;

  if (Object.keys(userUpdates).length > 0) {
    await User.findByIdAndUpdate(req.user._id, userUpdates, { runValidators: true });
  }

  // Update Student record for academic fields
  if (fatherName !== undefined) student.fatherName = fatherName;
  if (address !== undefined) student.address = address;
  if (name) student.name = name;
  if (mobileNumber) student.mobile = mobileNumber;

  await student.save();

  res.status(200).json(new ApiResponse(200, student, 'Profile updated successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get Teacher WhatsApp Link
// @route   GET /api/student/whatsapp/:teacherId
// @access  Private/Student
// ─────────────────────────────────────────────────────────────────────────────
export const getTeacherWhatsAppLink = asyncHandler(async (req, res, next) => {
  const { teacherId } = req.params;
  const teacher = await Teacher.findById(teacherId).populate('userId', 'name').lean();

  if (!teacher) return next(new ApiError(404, 'Teacher profile not found'));

  const mobile = teacher.mobile || '';
  if (!mobile) return next(new ApiError(400, 'Teacher does not have a registered mobile number'));

  let cleanMobile = mobile.replace(/\D/g, '');
  if (cleanMobile.startsWith('03')) cleanMobile = '92' + cleanMobile.slice(1);
  else if (cleanMobile.startsWith('3') && cleanMobile.length === 10) cleanMobile = '92' + cleanMobile;

  const teacherName = teacher.userId?.name || 'Teacher';
  const text = encodeURIComponent(`Hello ${teacherName}, I am a student from the Computer Science Department.`);
  const whatsappUrl = `https://wa.me/${cleanMobile}?text=${text}`;

  res.status(200).json(new ApiResponse(200, { whatsappUrl }, 'WhatsApp linkage generated successfully'));
});
