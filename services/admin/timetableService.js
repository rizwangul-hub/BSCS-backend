import Timetable from '../../models/Timetable.js';

// Helper to convert "HH:MM" 24h format to minutes from midnight
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Checks for timetable conflicts (teacher, room, or semester scheduling overlaps)
 * @param {Object} data - Timetable fields to evaluate
 * @returns {Promise<String|null>} Conflict message description, or null if no conflict
 */
export const checkTimetableConflict = async (data) => {
  const { day, startTime, endTime, teacher, roomNumber, semester, excludeId } = data;
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  if (newStart >= newEnd) {
    return 'Start time must be before end time.';
  }

  // Find other classes scheduled on the same day
  const query = { day };
  if (excludeId) {
    query._id = { $ne: excludeId }; // Exclude currently updated document
  }

  const existingClasses = await Timetable.find(query);

  for (const item of existingClasses) {
    const exStart = timeToMinutes(item.startTime);
    const exEnd = timeToMinutes(item.endTime);

    // Overlap condition: startA < endB && startB < endA
    if (newStart < exEnd && exStart < newEnd) {
      // 1. Teacher overlap check
      if (item.teacher.toString() === teacher.toString()) {
        return `Teacher conflict: This teacher is already scheduled for another class from ${item.startTime} to ${item.endTime} in room ${item.roomNumber}.`;
      }

      // 2. Room occupancy check
      if (item.roomNumber.toLowerCase() === roomNumber.toLowerCase()) {
        return `Room conflict: Room ${roomNumber} is already occupied by another class from ${item.startTime} to ${item.endTime}.`;
      }

      // 3. Semester schedule overlap check
      if (item.semester === Number(semester)) {
        return `Semester conflict: Semester ${semester} already has a scheduled class from ${item.startTime} to ${item.endTime} in room ${item.roomNumber}.`;
      }
    }
  }

  return null; // No conflicts found
};
