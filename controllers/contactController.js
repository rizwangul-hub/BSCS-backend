import asyncHandler from 'express-async-handler';
import ContactMessage from '../models/ContactMessage.js';
import { logAdminAction } from '../utils/auditLogger.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';

/**
 * @desc    Submit a contact message from the Landing Page
 * @route   POST /api/contact
 * @access  Public
 */
export const createContactMessage = asyncHandler(async (req, res, next) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return next(new ApiError(400, 'Please provide name, email, and message.'));
  }

  const contactMessage = await ContactMessage.create({
    name,
    email,
    message
  });

  res.status(201).json(new ApiResponse(201, contactMessage, 'Your message has been sent successfully.'));
});

/**
 * @desc    Get all contact messages
 * @route   GET /api/contact/admin/messages
 * @access  Private/Admin
 */
export const getContactMessages = asyncHandler(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const searchQuery = req.query.search || '';
  const query = {};

  if (searchQuery) {
    const regex = new RegExp(searchQuery, 'i');
    query.$or = [{ name: regex }, { email: regex }, { message: regex }];
  }

  const messages = await ContactMessage.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await ContactMessage.countDocuments(query);
  const pages = Math.ceil(total / limit);

  res.status(200).json(new ApiResponse(200, {
    messages,
    total,
    page,
    pages
  }, 'Contact messages retrieved successfully.'));
});

/**
 * @desc    Delete a contact message by ID
 * @route   DELETE /api/contact/admin/messages/:id
 * @access  Private/Admin
 */
export const deleteContactMessage = asyncHandler(async (req, res, next) => {
  const message = await ContactMessage.findById(req.params.id);

  if (!message) {
    return next(new ApiError(404, 'Contact message not found.'));
  }

  await message.deleteOne();

  // Audit log
  await logAdminAction(req, `Admin deleted contact message from ${message.name} (${message.email})`, 'contact', req.user._id);

  res.status(200).json(new ApiResponse(200, null, 'Message deleted successfully.'));
});
