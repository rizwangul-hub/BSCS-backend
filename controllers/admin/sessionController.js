import asyncHandler from 'express-async-handler';
import Session from '../../models/Session.js';
import Student from '../../models/Student.js';
import RegistrationNumber from '../../models/RegistrationNumber.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Create a new academic session
 * @route   POST /api/admin/sessions
 * @access  Private/Admin
 */
export const createSession = asyncHandler(async (req, res, next) => {
  const { sessionName, startYear, endYear } = req.body;

  const existingSession = await Session.findOne({ sessionName });
  if (existingSession) {
    return next(new ApiError(400, `Session ${sessionName} already exists.`));
  }

  const session = await Session.create({
    sessionName,
    startYear,
    endYear,
  });

  await logAdminAction(req, `Admin created academic session: ${session.sessionName}`, 'session');

  res.status(201).json(new ApiResponse(201, session, 'Academic session created successfully'));
});

/**
 * @desc    Bulk Semester Promotion
 * @route   POST /api/admin/promote-semester
 * @access  Private/Admin
 */
export const promoteSemester = asyncHandler(async (req, res, next) => {
  const { academicSession, currentSemester } = req.body;

  const semNumber = Number(currentSemester);

  // Validation: Semester 8 students should not be promoted
  if (semNumber >= 8) {
    return next(new ApiError(400, 'Semester 8 students are in their final semester and cannot be promoted.'));
  }

  // Find all active students in the selected session and semester
  const students = await Student.find({
    academicSession,
    semester: semNumber,
    currentStatus: 'active',
  });

  if (students.length === 0) {
    return next(new ApiError(404, 'No active students found matching the selected session and semester.'));
  }

  // Promote semester by 1
  const updateResult = await Student.updateMany(
    {
      academicSession,
      semester: semNumber,
      currentStatus: 'active',
    },
    {
      $inc: { semester: 1 },
    }
  );

  // Synchronize pre-registration records
  await RegistrationNumber.updateMany(
    {
      session: academicSession,
      semester: semNumber,
    },
    {
      $inc: { semester: 1 },
    }
  );

  await logAdminAction(
    req,
    `Admin promoted ${updateResult.modifiedCount} students from Semester ${semNumber} to Semester ${semNumber + 1} for session ${academicSession}`,
    'session'
  );

  res.status(200).json(
    new ApiResponse(
      200,
      {
        session: academicSession,
        fromSemester: semNumber,
        toSemester: semNumber + 1,
        promotedCount: updateResult.modifiedCount,
      },
      `Semester promotion successful. Promoted ${updateResult.modifiedCount} students.`
    )
  );
});

/**
 * @desc    Get all academic sessions
 * @route   GET /api/admin/sessions
 * @access  Private/Admin
 */
export const getSessions = asyncHandler(async (req, res, next) => {
  const sessions = await Session.find().sort({ startYear: -1 }).lean();
  res.status(200).json(new ApiResponse(200, sessions, 'Sessions retrieved successfully'));
});

/**
 * @desc    Update academic session
 * @route   PUT /api/admin/sessions/:id
 * @access  Private/Admin
 */
export const updateSession = asyncHandler(async (req, res, next) => {
  const session = await Session.findById(req.params.id);
  if (!session) {
    return next(new ApiError(404, 'Academic session not found'));
  }

  const { sessionName, startYear, endYear, isActive } = req.body;

  if (sessionName) session.sessionName = sessionName;
  if (startYear !== undefined) session.startYear = Number(startYear);
  if (endYear !== undefined) session.endYear = Number(endYear);
  if (isActive !== undefined) session.isActive = isActive;

  await session.save();

  await logAdminAction(req, `Admin updated academic session: ${session.sessionName}`, 'session');

  res.status(200).json(new ApiResponse(200, session, 'Academic session updated successfully'));
});

/**
 * @desc    Delete academic session
 * @route   DELETE /api/admin/sessions/:id
 * @access  Private/Admin
 */
export const deleteSession = asyncHandler(async (req, res, next) => {
  const session = await Session.findById(req.params.id);
  if (!session) {
    return next(new ApiError(404, 'Academic session not found'));
  }

  await session.deleteOne();

  await logAdminAction(req, `Admin deleted academic session: ${session.sessionName}`, 'session');

  res.status(200).json(new ApiResponse(200, {}, 'Academic session deleted successfully'));
});

