import asyncHandler from 'express-async-handler';
import Timetable from '../../models/Timetable.js';
import { checkTimetableConflict } from '../../services/admin/timetableService.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Create timetable entry with conflict prevention
 * @route   POST /api/admin/timetable
 * @access  Private/Admin
 */
export const createTimetable = asyncHandler(async (req, res, next) => {
  const { semester, subject, teacher, day, startTime, endTime, roomNumber } = req.body;

  // Check schedule conflicts
  const conflict = await checkTimetableConflict({
    day,
    startTime,
    endTime,
    teacher,
    roomNumber,
    semester,
  });

  if (conflict) {
    return next(new ApiError(400, conflict));
  }

  const timetable = await Timetable.create({
    semester,
    subject,
    teacher,
    day,
    startTime,
    endTime,
    roomNumber,
  });

  await logAdminAction(
    req,
    `Admin scheduled class for Semester ${semester} in room ${roomNumber} (${day} ${startTime}-${endTime})`,
    'timetable'
  );

  res.status(201).json(new ApiResponse(201, timetable, 'Timetable entry created successfully'));
});

/**
 * @desc    Get all timetable slots
 * @route   GET /api/admin/timetable
 * @access  Private/Admin
 */
export const getTimetables = asyncHandler(async (req, res, next) => {
  const { semester } = req.query;
  const query = {};
  if (semester) query.semester = Number(semester);

  const timetable = await Timetable.find(query)
    .populate('subject', 'subjectName subjectCode creditHours academicSession')
    .populate({
      path: 'teacher',
      populate: { path: 'userId', select: 'name' }
    })
    .lean();

  res.status(200).json(new ApiResponse(200, timetable, 'Timetable slots retrieved successfully'));
});

/**
 * @desc    Update a timetable slot
 * @route   PUT /api/admin/timetable/:id
 * @access  Private/Admin
 */
export const updateTimetable = asyncHandler(async (req, res, next) => {
  const slot = await Timetable.findById(req.params.id);
  if (!slot) {
    return next(new ApiError(404, 'Timetable slot not found'));
  }

  const { semester, subject, teacher, day, startTime, endTime, roomNumber } = req.body;

  // Check schedule conflicts excluding the current slot
  const conflict = await checkTimetableConflict({
    day: day || slot.day,
    startTime: startTime || slot.startTime,
    endTime: endTime || slot.endTime,
    teacher: teacher || slot.teacher,
    roomNumber: roomNumber || slot.roomNumber,
    semester: semester !== undefined ? Number(semester) : slot.semester,
    excludeId: slot._id,
  });

  if (conflict) {
    return next(new ApiError(400, conflict));
  }

  if (semester !== undefined) slot.semester = Number(semester);
  if (subject) slot.subject = subject;
  if (teacher) slot.teacher = teacher;
  if (day) slot.day = day;
  if (startTime) slot.startTime = startTime;
  if (endTime) slot.endTime = endTime;
  if (roomNumber) slot.roomNumber = roomNumber;

  await slot.save();

  await logAdminAction(
    req,
    `Admin updated timetable slot for Semester ${slot.semester} in room ${slot.roomNumber} (${slot.day} ${slot.startTime}-${slot.endTime})`,
    'timetable'
  );

  res.status(200).json(new ApiResponse(200, slot, 'Timetable slot updated successfully'));
});

/**
 * @desc    Delete a timetable slot
 * @route   DELETE /api/admin/timetable/:id
 * @access  Private/Admin
 */
export const deleteTimetable = asyncHandler(async (req, res, next) => {
  const slot = await Timetable.findById(req.params.id);
  if (!slot) {
    return next(new ApiError(404, 'Timetable slot not found'));
  }

  await slot.deleteOne();

  await logAdminAction(
    req,
    `Admin deleted timetable slot for Semester ${slot.semester} in room ${slot.roomNumber} (${slot.day} ${slot.startTime}-${slot.endTime})`,
    'timetable'
  );

  res.status(200).json(new ApiResponse(200, {}, 'Timetable slot deleted successfully'));
});

