import asyncHandler from 'express-async-handler';
import Notice from '../../models/Notice.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import { broadcastToRoom } from '../../sockets/socketService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Create notice and broadcast notifications
 * @route   POST /api/admin/notices
 * @access  Private/Admin
 */
export const createNotice = asyncHandler(async (req, res, next) => {
  const { title, description, targetAudience, expiryDate } = req.body;

  // 1. Create notice document
  const notice = await Notice.create({
    title,
    description,
    targetAudience,
    postedBy: req.user._id,
    expiryDate: expiryDate || null,
  });

  // 2. Query target users to receive notifications
  let userQuery = {};
  if (targetAudience === 'students') {
    userQuery = { role: 'student' };
  } else if (targetAudience === 'teachers') {
    userQuery = { role: 'teacher' };
  } else {
    userQuery = { role: { $in: ['student', 'teacher', 'admin'] } };
  }

  const targetUsers = await User.find(userQuery).select('_id');

  // 3. Create Notification entries in bulk
  if (targetUsers.length > 0) {
    const notifications = targetUsers.map((u) => ({
      receiver: u._id,
      title: `New Announcement: ${title}`,
      message: description,
      type: 'notice',
    }));

    await Notification.insertMany(notifications);
  }

  // 4. Real-time broadcast via Socket.IO
  broadcastToRoom(targetAudience, 'newNotice', {
    id: notice._id,
    title: notice.title,
    description: notice.description,
    postedBy: req.user.name,
    createdAt: notice.createdAt,
  });

  await logAdminAction(req, `Admin posted notice: ${notice.title}`, 'notice');

  res.status(201).json(new ApiResponse(201, notice, 'Notice posted and notifications broadcasted successfully'));
});

/**
 * @desc    Delete notice
 * @route   DELETE /api/admin/notices/:id
 * @access  Private/Admin
 */
export const deleteNotice = asyncHandler(async (req, res, next) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) {
    return next(new ApiError(404, 'Notice not found'));
  }

  await notice.deleteOne();

  await logAdminAction(req, `Admin deleted notice: ${notice.title}`, 'notice');

  res.status(200).json(new ApiResponse(200, {}, 'Notice deleted successfully'));
});

/**
 * @desc    Get all notices
 * @route   GET /api/admin/notices
 * @access  Private/Admin
 */
export const getNotices = asyncHandler(async (req, res, next) => {
  const notices = await Notice.find()
    .sort({ createdAt: -1 })
    .populate('postedBy', 'name')
    .lean();

  res.status(200).json(new ApiResponse(200, notices, 'Notices retrieved successfully'));
});

/**
 * @desc    Update a notice
 * @route   PUT /api/admin/notices/:id
 * @access  Private/Admin
 */
export const updateNotice = asyncHandler(async (req, res, next) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) {
    return next(new ApiError(404, 'Notice not found'));
  }

  const { title, description, targetAudience, expiryDate } = req.body;

  if (title) notice.title = title;
  if (description) notice.description = description;
  if (targetAudience) notice.targetAudience = targetAudience;
  if (expiryDate !== undefined) notice.expiryDate = expiryDate || null;

  await notice.save();

  await logAdminAction(req, `Admin updated notice: ${notice.title}`, 'notice');

  res.status(200).json(new ApiResponse(200, notice, 'Notice updated successfully'));
});

