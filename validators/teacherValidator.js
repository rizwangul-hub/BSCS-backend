import { body } from 'express-validator';
import { validate } from './authValidator.js';

export const validateAddAttendance = [
  body('student').isMongoId().withMessage('Valid student ID is required'),
  body('subject').isMongoId().withMessage('Valid subject ID is required'),
  body('month')
    .isIn([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ])
    .withMessage('Valid month name is required'),
  body('year')
    .isInt({ min: 2000 })
    .withMessage('Year must be an integer after 2000'),
  body('totalClasses')
    .isInt({ min: 1 })
    .withMessage('Total classes must be an integer greater than 0'),
  body('attendedClasses')
    .isInt({ min: 0 })
    .withMessage('Attended classes must be a positive integer')
    .custom((value, { req }) => {
      if (Number(value) > Number(req.body.totalClasses)) {
        throw new Error('Attended classes cannot exceed total classes');
      }
      return true;
    }),
  validate,
];

export const validateUpdateAttendance = [
  body('totalClasses')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total classes must be an integer greater than 0'),
  body('attendedClasses')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Attended classes must be a positive integer')
    .custom((value, { req }) => {
      // If updating both, validate range
      const total = req.body.totalClasses !== undefined ? Number(req.body.totalClasses) : null;
      if (total !== null && Number(value) > total) {
        throw new Error('Attended classes cannot exceed total classes');
      }
      return true;
    }),
  validate,
];

export const validateAddMarks = [
  body('student').isMongoId().withMessage('Valid student ID is required'),
  body('subject').isMongoId().withMessage('Valid subject ID is required'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('midMarks')
    .optional()
    .isFloat({ min: 0, max: 30 })
    .withMessage('Mid term marks must be between 0 and 30'),
  body('presentation')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Presentation marks must be between 0 and 5'),
  body('test1')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Test 1 marks must be between 0 and 5'),
  body('test2')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Test 2 marks must be between 0 and 5'),
  body('assignment')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Assignment marks must be between 0 and 5'),
  body('quiz')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Quiz marks must be between 0 and 5'),
  body('attendanceMarks')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Attendance marks must be between 0 and 5'),
  validate,
];

export const validateUpdateMarks = [
  body('midMarks')
    .optional()
    .isFloat({ min: 0, max: 30 })
    .withMessage('Mid term marks must be between 0 and 30'),
  body('presentation')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Presentation marks must be between 0 and 5'),
  body('test1')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Test 1 marks must be between 0 and 5'),
  body('test2')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Test 2 marks must be between 0 and 5'),
  body('assignment')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Assignment marks must be between 0 and 5'),
  body('quiz')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Quiz marks must be between 0 and 5'),
  body('attendanceMarks')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Attendance marks must be between 0 and 5'),
  validate,
];

export const validateCreateAssignment = [
  body('title').trim().notEmpty().withMessage('Assignment title is required'),
  body('description').optional().trim(),
  body('deadline').isISO8601().withMessage('Valid deadline date is required'),
  body('subject').isMongoId().withMessage('Valid subject ID is required'),
  validate,
];

export const validateReplyComplaint = [
  body('reply').trim().notEmpty().withMessage('Reply content is required'),
  validate,
];
