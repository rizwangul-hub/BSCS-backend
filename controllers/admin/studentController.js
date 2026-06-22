import asyncHandler from 'express-async-handler';
import User from '../../models/User.js';
import Student from '../../models/Student.js';
import { createStudent } from '../../services/admin/studentService.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import { emitForceLogout } from '../../sockets/socketService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Get all students (paginated list)
 * @route   GET /api/admin/students
 * @access  Private/Admin
 */
export const getAllStudents = asyncHandler(async (req, res, next) => {
  const page     = Number(req.query.page)     || 1;
  const limit    = Number(req.query.limit)    || 15;
  const skip     = (page - 1) * limit;
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  const session  = req.query.session;
  const status   = req.query.status;

  const query = {};
  if (semester) query.semester = semester;
  if (session)  query.academicSession = session;
  if (status)   query.currentStatus = status;

  const [students, total] = await Promise.all([
    Student.find(query)
      .populate('userId', 'email isActive isBlocked lastLogin')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, { students, total, page, pages: Math.ceil(total / limit) }, 'Students list fetched')
  );
});

/**
 * @desc    Get single student by ID
 * @route   GET /api/admin/students/:id
 * @access  Private/Admin
 */
export const getStudentById = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id)
    .populate('userId', 'email isActive isBlocked lastLogin')
    .lean();
  if (!student) return next(new ApiError(404, 'Student not found'));
  res.status(200).json(new ApiResponse(200, student, 'Student fetched'));
});

/**
 * @desc    Add a new student
 * @route   POST /api/admin/students
 * @access  Private/Admin
 */
export const addStudent = asyncHandler(async (req, res, next) => {
  const result = await createStudent(req.body, true);

  // Log admin audit action
  await logAdminAction(req, `Admin created student account for: ${result.student.name}`, 'student', result.user._id);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        userId: result.user._id,
        studentId: result.student._id,
        name: result.student.name,
        registrationNumber: result.student.registrationNumber,
        rollNumber: result.student.rollNumber,
      },
      'Student added successfully'
    )
  );
});

/**
 * @desc    Edit student details
 * @route   PUT /api/admin/students/:id
 * @access  Private/Admin
 */
export const editStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ApiError(404, 'Student not found'));
  }

  const { semester, mobile, address, academicSession, currentStatus } = req.body;

  // Update Student profile fields
  if (semester !== undefined) student.semester = semester;
  if (mobile !== undefined) student.mobile = mobile;
  if (address !== undefined) student.address = address;
  if (academicSession !== undefined) student.academicSession = academicSession;
  if (currentStatus !== undefined) student.currentStatus = currentStatus;

  await student.save();

  // Keep User account in sync
  const user = await User.findById(student.userId);
  if (user) {
    if (mobile !== undefined) user.mobileNumber = mobile;
    if (address !== undefined) user.address = address;
    if (currentStatus !== undefined) {
      user.isActive = currentStatus === 'active';
    }
    await user.save({ validateBeforeSave: false });
  }

  await logAdminAction(req, `Admin updated student details for: ${student.name}`, 'student', student.userId);

  res.status(200).json(new ApiResponse(200, student, 'Student updated successfully'));
});

/**
 * @desc    Delete student (Soft delete)
 * @route   DELETE /api/admin/students/:id
 * @access  Private/Admin
 */
export const deleteStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ApiError(404, 'Student not found'));
  }

  // Soft delete Student
  student.currentStatus = 'suspended';
  await student.save();

  // Deactivate User account
  const user = await User.findById(student.userId);
  if (user) {
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = undefined; // clear session
    await user.save({ validateBeforeSave: false });

    // Instantly boot them from WebSocket
    emitForceLogout(user._id);
  }

  await logAdminAction(req, `Admin soft deleted student: ${student.name}`, 'student', student.userId);

  res.status(200).json(new ApiResponse(200, {}, 'Student deleted successfully (Soft Deleted)'));
});

/**
 * @desc    Block student and invalidate session
 * @route   PATCH /api/admin/students/:id/block
 * @access  Private/Admin
 */
export const blockStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ApiError(404, 'Student not found'));
  }

  const user = await User.findById(student.userId);
  if (!user) {
    return next(new ApiError(404, 'Linked student User account not found'));
  }

  user.isBlocked = true;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshToken = undefined; // Revoke refresh token session
  await user.save({ validateBeforeSave: false });

  // Force socket logout
  emitForceLogout(user._id);

  await logAdminAction(req, `Admin blocked student: ${student.name}`, 'student', user._id);

  res.status(200).json(new ApiResponse(200, {}, 'Student blocked successfully. Session revoked.'));
});

/**
 * @desc    Unblock student
 * @route   PATCH /api/admin/students/:id/unblock
 * @access  Private/Admin
 */
export const unblockStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ApiError(404, 'Student not found'));
  }

  const user = await User.findById(student.userId);
  if (!user) {
    return next(new ApiError(404, 'Linked student User account not found'));
  }

  user.isBlocked = false;
  await user.save({ validateBeforeSave: false });

  await logAdminAction(req, `Admin unblocked student: ${student.name}`, 'student', user._id);

  res.status(200).json(new ApiResponse(200, {}, 'Student unblocked successfully.'));
});

/**
 * @desc    Search students with filters
 * @route   GET /api/admin/students/search
 * @access  Private/Admin
 */
export const searchStudents = asyncHandler(async (req, res, next) => {
  const { name, registrationNumber, semester, session, status } = req.query;

  const query = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' }; // Regex text search
  }
  if (registrationNumber) {
    query.registrationNumber = { $regex: registrationNumber, $options: 'i' };
  }
  if (semester) {
    query.semester = Number(semester);
  }
  if (session) {
    query.academicSession = session;
  }
  if (status) {
    query.currentStatus = status;
  }

  const students = await Student.find(query).populate('userId', 'email isActive isBlocked');

  res.status(200).json(new ApiResponse(200, students, 'Students query completed'));
});
