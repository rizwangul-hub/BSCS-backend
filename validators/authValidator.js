import { body, validationResult } from 'express-validator';
import ApiError from '../utils/apiError.js';

// Middleware to check validation results and handle errors
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.path]: err.msg }));

  return next(new ApiError(422, 'Validation failed', extractedErrors));
};

// Validation rules for Registration (Admin creating profiles or self-reg)
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('mobileNumber')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'teacher', 'student'])
    .withMessage('Role must be admin, teacher, or student'),
  validate,
];

// Validation rules for Login
export const validateLogin = [
  body('mobileNumber')
    .trim()
    .notEmpty()
    .withMessage('Mobile number or registration number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate,
];

// Validation rules for Forgot Password
export const validateForgotPassword = [
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('mobileNumber')
    .optional({ checkFalsy: true })
    .trim()
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('email').custom((value, { req }) => {
    if (!req.body.email && !req.body.mobileNumber) {
      throw new Error('Please provide either email or mobile number');
    }
    return true;
  }),
  validate,
];

// Validation rules for Reset Password
export const validateResetPassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  validate,
];
