import express from 'express';
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  getMe,
  registerStudent,
  changePassword,
  runMigrationLogic,
} from '../controllers/authController.js';
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/authValidator.js';
import { protect } from '../middlewares/authMiddleware.js';
import upload from '../config/multer.js';
import Session from '../models/Session.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

// Public routes
router.post('/register', upload.single('profilePicture'), validateRegister, register);
router.post('/register-student', registerStudent);
router.get('/run-migration', runMigrationLogic);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', validateResetPassword, resetPassword);
router.post('/refresh-token', refreshToken);
router.get('/sessions', asyncHandler(async (req, res) => {
  const sessions = await Session.find({ isActive: true }).sort({ startYear: -1 }).lean();
  res.status(200).json(new ApiResponse(200, sessions, 'Active sessions retrieved successfully'));
}));

// Protected routes
router.post('/logout',          protect, logout);
router.get('/me',               protect, getMe);
router.put('/change-password',  protect, changePassword);

export default router;
