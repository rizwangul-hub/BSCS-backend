import asyncHandler from 'express-async-handler';
import Student from '../../models/Student.js';
import Complaint from '../../models/Complaint.js';
import Notification from '../../models/Notification.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Get all student complaints
 * @route   GET /api/admin/complaints
 * @access  Private/Admin
 */
export const getComplaints = asyncHandler(async (req, res, next) => {
  const { status, category } = req.query;

  const query = {};
  if (status) {
    if (!['pending', 'reviewing', 'resolved', 'rejected'].includes(status)) {
      return next(new ApiError(400, 'Invalid status filter.'));
    }
    query.status = status;
  }
  if (category) {
    query.category = category;
  }

  const complaints = await Complaint.find(query)
    .sort({ createdAt: -1 })
    .populate('student', 'name rollNumber registrationNumber semester academicSession')
    .lean();

  res.status(200).json(new ApiResponse(200, complaints, 'Complaints retrieved successfully'));
});

/**
 * @desc    Reply to Student Complaint
 * @route   POST /api/admin/complaints/:id/reply
 * @access  Private/Admin
 */
export const replyComplaint = asyncHandler(async (req, res, next) => {
  const { reply, status } = req.body;

  if (!reply?.trim()) {
    return next(new ApiError(400, 'Reply content is required.'));
  }

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    return next(new ApiError(404, 'Complaint not found.'));
  }

  const student = await Student.findById(complaint.student).lean();
  if (!student) {
    return next(new ApiError(404, 'Associated student not found.'));
  }

  // Update complaint details
  complaint.reply = reply;
  complaint.status = status || 'resolved';
  complaint.repliedBy = req.user._id;
  complaint.repliedAt = Date.now();

  await complaint.save();

  // Notify student
  await Notification.create({
    receiver: student.userId,
    title: 'Complaint Replied',
    message: `Your complaint has been replied to by Admin. Status: ${complaint.status}.`,
    type: 'complaint'
  });

  // Log audit action
  await logAdminAction(
    req,
    `Admin replied to complaint from student ${student.name} (Status: ${complaint.status})`,
    'complaint',
    student.userId
  );

  res.status(200).json(new ApiResponse(200, complaint, 'Complaint replied successfully'));
});
