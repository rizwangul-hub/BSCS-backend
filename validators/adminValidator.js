import { body } from 'express-validator';
import { validate } from './authValidator.js'; // reuse existing validate middleware

export const validateAddStudent = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('registrationNumber').trim().notEmpty().withMessage('Registration number is required'),
  body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('academicSession').trim().notEmpty().withMessage('Academic session is required'),
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
  validate,
];

export const validateEditStudent = [
  body('semester')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8'),
  body('mobile')
    .optional({ checkFalsy: true })
    .trim()
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('address').optional().trim(),
  body('academicSession').optional().trim(),
  body('currentStatus')
    .optional()
    .isIn(['active', 'graduated', 'suspended'])
    .withMessage('Status must be active, graduated, or suspended'),
  validate,
];

export const validateAddTeacher = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('teacherId').trim().notEmpty().withMessage('Teacher ID is required'),
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
  body('qualification').trim().notEmpty().withMessage('Qualification is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  validate,
];

export const validateEditTeacher = [
  body('qualification').optional().trim(),
  body('designation').optional().trim(),
  body('mobile')
    .optional({ checkFalsy: true })
    .trim()
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('address').optional().trim(),
  validate,
];

export const validateCreateSubject = [
  body('subjectName').trim().notEmpty().withMessage('Subject name is required'),
  body('subjectCode').trim().notEmpty().withMessage('Subject code is required'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('creditHours')
    .isInt({ min: 1, max: 6 })
    .withMessage('Credit hours must be between 1 and 6'),
  body('academicSession').trim().notEmpty().withMessage('Academic session is required'),
  validate,
];

export const validateCreateSession = [
  body('sessionName').trim().notEmpty().withMessage('Session name is required'),
  body('startYear').isInt().withMessage('Start year must be an integer'),
  body('endYear').isInt().withMessage('End year must be an integer'),
  validate,
];

export const validateCreateTimetable = [
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('subject').isMongoId().withMessage('Valid subject ObjectId is required'),
  body('teacher').isMongoId().withMessage('Valid teacher ObjectId is required'),
  body('day')
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Valid day of week is required'),
  body('startTime')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Start time must be in HH:MM 24-hour format'),
  body('endTime')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('End time must be in HH:MM 24-hour format'),
  body('roomNumber').trim().notEmpty().withMessage('Room number is required'),
  validate,
];

export const validateCreateNotice = [
  body('title').trim().notEmpty().withMessage('Notice title is required'),
  body('description').trim().notEmpty().withMessage('Notice description is required'),
  body('targetAudience')
    .isIn(['students', 'teachers', 'all'])
    .withMessage('Target audience must be students, teachers, or all'),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Valid expiry date is required'),
  validate,
];

export const validateCreatePreRegistration = [
  body('registrationNumber').trim().notEmpty().withMessage('Registration number is required'),
  body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('session').trim().notEmpty().withMessage('Session is required'),
  validate,
];

export const validateUpdatePreRegistration = [
  body('rollNumber').optional().trim().notEmpty().withMessage('Roll number cannot be empty'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8'),
  body('session').optional().trim().notEmpty().withMessage('Session cannot be empty'),
  validate,
];

