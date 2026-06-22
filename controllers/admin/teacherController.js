import asyncHandler from 'express-async-handler';
import User from '../../models/User.js';
import Teacher from '../../models/Teacher.js';
import { createTeacher } from '../../services/admin/teacherService.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import { emitForceLogout } from '../../sockets/socketService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Add a new teacher
 * @route   POST /api/admin/teachers
 * @access  Private/Admin
 */
export const addTeacher = asyncHandler(async (req, res, next) => {
  const result = await createTeacher(req.body);

  await logAdminAction(req, `Admin created teacher account for: ${result.user.name}`, 'teacher', result.user._id);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        userId: result.user._id,
        teacherProfileId: result.teacher._id,
        name: result.user.name,
        teacherId: result.teacher.teacherId,
      },
      'Teacher added successfully'
    )
  );
});

/**
 * @desc    Edit teacher details
 * @route   PUT /api/admin/teachers/:id
 * @access  Private/Admin
 */
export const editTeacher = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ApiError(404, 'Teacher not found'));
  }

  const { qualification, designation, mobile, address, department } = req.body;

  // Update Teacher profile
  if (qualification !== undefined) teacher.qualification = qualification;
  if (designation !== undefined) teacher.designation = designation;
  if (mobile !== undefined) teacher.mobile = mobile;
  if (address !== undefined) teacher.address = address;
  if (department !== undefined) teacher.department = department;

  await teacher.save();

  // Sync with User document
  const user = await User.findById(teacher.userId);
  if (user) {
    if (mobile !== undefined) user.mobileNumber = mobile;
    if (address !== undefined) user.address = address;
    await user.save({ validateBeforeSave: false });
  }

  await logAdminAction(req, `Admin updated teacher details for: ${user ? user.name : 'Unknown'}`, 'teacher', teacher.userId);

  res.status(200).json(new ApiResponse(200, teacher, 'Teacher updated successfully'));
});

/**
 * @desc    Delete teacher (Soft delete)
 * @route   DELETE /api/admin/teachers/:id
 * @access  Private/Admin
 */
export const deleteTeacher = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ApiError(404, 'Teacher not found'));
  }

  // Deactivate User account (Soft delete)
  const user = await User.findById(teacher.userId);
  if (user) {
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });

    // Force socket logout
    emitForceLogout(user._id);
  }

  await logAdminAction(req, `Admin soft deleted teacher: ${user ? user.name : 'Unknown'}`, 'teacher', teacher.userId);

  res.status(200).json(new ApiResponse(200, {}, 'Teacher deleted successfully (Soft Deleted)'));
});

/**
 * @desc    Block teacher and revoke sessions
 * @route   PATCH /api/admin/teachers/:id/block
 * @access  Private/Admin
 */
export const blockTeacher = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ApiError(404, 'Teacher not found'));
  }

  const user = await User.findById(teacher.userId);
  if (!user) {
    return next(new ApiError(404, 'Linked teacher User account not found'));
  }

  user.isBlocked = true;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshToken = undefined; // Revoke active session
  await user.save({ validateBeforeSave: false });

  // Force socket logout
  emitForceLogout(user._id);

  await logAdminAction(req, `Admin blocked teacher: ${user.name}`, 'teacher', user._id);

  res.status(200).json(new ApiResponse(200, {}, 'Teacher blocked successfully. Session revoked.'));
});

/**
 * @desc    Unblock teacher
 * @route   PATCH /api/admin/teachers/:id/unblock
 * @access  Private/Admin
 */
export const unblockTeacher = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ApiError(404, 'Teacher not found'));
  }

  const user = await User.findById(teacher.userId);
  if (!user) {
    return next(new ApiError(404, 'Linked teacher User account not found'));
  }

  user.isBlocked = false;
  await user.save({ validateBeforeSave: false });

  await logAdminAction(req, `Admin unblocked teacher: ${user.name}`, 'teacher', user._id);

  res.status(200).json(new ApiResponse(200, {}, 'Teacher unblocked successfully.'));
});

/**
 * @desc    Get all teachers
 * @route   GET /api/admin/teachers
 * @access  Private/Admin
 */
export const getTeachers = asyncHandler(async (req, res, next) => {
  const teachers = await Teacher.find()
    .populate('userId', 'name email mobileNumber isActive isBlocked')
    .populate('subjects', 'subjectName subjectCode semester academicSession')
    .lean();

  res.status(200).json(new ApiResponse(200, teachers, 'Teachers retrieved successfully'));
});

