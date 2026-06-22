import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import User from '../models/User.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import sendEmail from '../services/emailService.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import RegistrationNumber from '../models/RegistrationNumber.js';
import { createStudent } from '../services/admin/studentService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { uploadBufferToCloudinary } from '../config/cloudinary.js';

/**
 * Helper to set cookies for tokens
 */
const sendTokenResponse = (user, statusCode, message, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token to user document
  user.refreshToken = refreshToken;
  user.save({ validateBeforeSave: false });

  // Cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching refresh token expiry
  };

  res
    .status(statusCode)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        statusCode,
        {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            mobileNumber: user.mobileNumber,
            role: user.role,
            profileImage: user.profileImage,
            address: user.address,
            isActive: user.isActive,
            isBlocked: user.isBlocked,
            lastLogin: user.lastLogin,
          },
          role: user.role,
          accessToken,
        },
        message
      )
    );
};

/**
 * @desc    Register a new User (Admin, Teacher, or Student)
 * @route   POST /api/auth/register
 * @access  Public (Can be restricted later or used by Admins to seed profiles)
 */
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, mobileNumber, password, role, address } = req.body;

  // 1. Check if user already exists (mobileNumber or email)
  const existingUserByMobile = await User.findOne({ mobileNumber });
  if (existingUserByMobile) {
    return next(new ApiError(400, 'User with this mobile number already exists.'));
  }

  if (email) {
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return next(new ApiError(400, 'User with this email already exists.'));
    }
  }

  // 2. Upload profile picture to Cloudinary if provided
  let profileImageUrl = '';
  if (req.file) {
    try {
      profileImageUrl = await uploadBufferToCloudinary(req.file.buffer, 'gpgc_profiles');
    } catch (uploadError) {
      return next(new ApiError(500, `Profile picture upload failed: ${uploadError.message}`));
    }
  }

  // 3. Create new user
  const user = await User.create({
    name,
    email,
    mobileNumber,
    password,
    role,
    address,
    profileImage: profileImageUrl,
  });

  sendTokenResponse(user, 201, 'User registered successfully', res);
});

/**
 * @desc    Login user using mobile number and password
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return next(new ApiError(400, 'Please provide credentials and password.'));
  }

  let user = null;
  const credentialStr = mobileNumber.trim();

  // 1. First, check if the input is a student registration number by looking up the Student model.
  const studentProfile = await Student.findOne({ 
    registrationNumber: { $regex: new RegExp(`^${credentialStr}$`, 'i') } 
  }).lean();

  if (studentProfile) {
    // If student is found, get the associated User document
    user = await User.findById(studentProfile.userId).select('+password');
  }

  // 2. If no student profile was found, or no user document was associated, search directly by mobile number in User model
  if (!user) {
    user = await User.findOne({ mobileNumber: credentialStr }).select('+password');
  }

  if (!user) {
    return next(new ApiError(401, 'Invalid credentials.'));
  }

  // 3. Check if account is active and not blocked
  if (!user.isActive) {
    return next(new ApiError(403, 'Your account is inactive. Please contact administration.'));
  }

  if (user.isBlocked) {
    return next(new ApiError(403, 'Your account has been blocked. Access denied.'));
  }

  // 4. Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new ApiError(401, 'Invalid credentials.'));
  }

  // 5. Update last login timestamp
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, 'Login successful', res);
});

/**
 * @desc    Logout user & clear refresh token
 * @route   POST /api/auth/logout
 * @access  Protected
 */
export const logout = asyncHandler(async (req, res, next) => {
  // Clear refresh token in database for this user
  if (req.user) {
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });
  }

  // Clear cookie
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully.'));
});

/**
 * @desc    Forgot Password - Request reset link via email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email, mobileNumber } = req.body;

  let query = {};
  if (email) {
    query = { email };
  } else if (mobileNumber) {
    query = { mobileNumber };
  }

  const user = await User.findOne(query);
  if (!user) {
    return next(new ApiError(404, 'No user found with the provided details.'));
  }

  if (!user.email) {
    return next(
      new ApiError(400, 'No email address is registered on this account to send a reset link.')
    );
  }

  // 1. Generate and save reset token
  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  // 2. Create password reset url
  const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

  // 3. Draft email content
  const message = `You are receiving this email because a password reset request was made for your account in GPGC Computer Science Department Management System. Please make a PUT request to: \n\n ${resetUrl}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #2c3e50;">GPGC Computer Science Department</h2>
      <p>Hello ${user.name},</p>
      <p>We received a request to reset your password. Click the button below to set a new password. This link will expire in 10 minutes.</p>
      <div style="margin: 25px 0;">
        <a href="${resetUrl}" target="_blank" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #7f8c8d; font-size: 12px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'GPGC Management System - Password Reset Request',
      message,
      html: htmlContent,
    });

    res
      .status(200)
      .json(new ApiResponse(200, {}, `Password reset link sent to registered email: ${user.email}`));
  } catch (error) {
    // Reset token fields if email sending fails
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ApiError(500, `Email could not be sent: ${error.message}`));
  }
});

/**
 * @desc    Reset password using token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
  // 1. Hash parameter token to match stored value
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // 2. Find user by hashed token and check expiration
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError(400, 'Invalid or expired password reset token.'));
  }

  // 3. Set new password and invalidate session tokens
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined; // Force logout from all active sessions

  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset successful. Please login with your new password.'));
});

/**
 * @desc    Refresh Access Token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
export const refreshToken = asyncHandler(async (req, res, next) => {
  let token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return next(new ApiError(401, 'Refresh token is required.'));
  }

  try {
    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return next(new ApiError(403, 'Invalid or expired refresh token.'));
    }

    if (!user.isActive || user.isBlocked) {
      return next(new ApiError(403, 'Account is inactive or blocked.'));
    }

    const newAccessToken = generateAccessToken(user);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken: newAccessToken },
          'Token refreshed successfully'
        )
      );
  } catch (error) {
    return next(new ApiError(403, 'Invalid or expired refresh token.'));
  }
});

/**
 * @desc    Get Current User Profile with role profile details
 * @route   GET /api/auth/me
 * @access  Protected
 */
export const getMe = asyncHandler(async (req, res, next) => {
  let profile = null;
  if (req.user.role === 'teacher') {
    profile = await Teacher.findOne({ userId: req.user._id }).populate('subjects');
  } else if (req.user.role === 'student') {
    profile = await Student.findOne({ userId: req.user._id });
  }

  res
    .status(200)
    .json(new ApiResponse(200, { user: req.user, profile }, 'Current user profile retrieved.'));
});

/**
 * @desc    Student Self-Registration
 * @route   POST /api/auth/register-student
 * @access  Public
 */
export const registerStudent = asyncHandler(async (req, res, next) => {
  // Enforce role to student
  req.body.role = 'student';
  const result = await createStudent(req.body, false);
  sendTokenResponse(result.user, 201, 'Student self-registered successfully', res);
});

/**
 * @desc    Change Password (any authenticated user)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ApiError(400, 'Please provide current and new passwords.'));
  }
  if (newPassword.length < 6) {
    return next(new ApiError(400, 'New password must be at least 6 characters.'));
  }

  // Fetch user with password field (normally excluded)
  const user = await User.findById(req.user._id).select('+password');
  if (!user) return next(new ApiError(404, 'User not found.'));

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) return next(new ApiError(401, 'Current password is incorrect.'));

  user.password = newPassword; // The User model pre-save hook will bcrypt this
  await user.save();

  res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully.'));
});

/**
 * @desc    Run database migration over HTTP
 * @route   GET /api/auth/run-migration
 * @access  Public
 */
export const runMigrationLogic = asyncHandler(async (req, res, next) => {
  const students = await Student.find({}).lean();
  let migratedCount = 0;
  let skippedCount = 0;

  for (const student of students) {
    const regNoClean = student.registrationNumber ? student.registrationNumber.trim() : '';
    if (!regNoClean) {
      skippedCount++;
      continue;
    }

    const existing = await RegistrationNumber.findOne({
      registrationNumber: { $regex: new RegExp(`^${regNoClean}$`, 'i') }
    });

    if (existing) {
      existing.rollNumber = student.rollNumber;
      existing.name = student.name;
      existing.semester = student.semester;
      existing.session = student.academicSession;
      existing.isRegistered = true;
      await existing.save();
      skippedCount++;
    } else {
      await RegistrationNumber.create({
        registrationNumber: regNoClean,
        rollNumber: student.rollNumber,
        name: student.name,
        semester: student.semester,
        session: student.academicSession,
        isRegistered: true,
      });
      migratedCount++;
    }
  }

  res.status(200).json(new ApiResponse(200, { migratedCount, skippedCount }, 'Migration run successfully'));
});

