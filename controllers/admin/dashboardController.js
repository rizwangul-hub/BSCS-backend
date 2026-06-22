import asyncHandler from 'express-async-handler';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import Subject from '../../models/Subject.js';
import Complaint from '../../models/Complaint.js';
import User from '../../models/User.js';
import Attendance from '../../models/Attendance.js';
import AuditLog from '../../models/AuditLog.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Get dashboard metrics and activities
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
export const getDashboardStats = asyncHandler(async (req, res, next) => {
  // 1. Database Counts
  const totalStudents = await Student.countDocuments();
  const totalTeachers = await Teacher.countDocuments();
  const totalSubjects = await Subject.countDocuments();
  const totalComplaints = await Complaint.countDocuments();

  // 2. User Status counts
  const activeUsers = await User.countDocuments({ isActive: true, isBlocked: false });
  const blockedUsers = await User.countDocuments({ isBlocked: true });
  const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

  // 3. Calculate Overall Attendance Average
  const attendanceAverageResult = await Attendance.aggregate([
    {
      $group: {
        _id: null,
        average: { $avg: '$attendancePercentage' },
      },
    },
  ]);
  const attendanceAverage =
    attendanceAverageResult.length > 0
      ? Math.round(attendanceAverageResult[0].average * 100) / 100
      : 0;

  // 4. Fetch Recent Admin/System Activities (Audit logs)
  const recentActivities = await AuditLog.find()
    .sort({ timestamp: -1 })
    .limit(5)
    .populate('performedBy', 'name role')
    .populate('targetUser', 'name role');

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalStudents,
        totalTeachers,
        totalSubjects,
        totalComplaints,
        activeUsers,
        blockedUsers,
        pendingComplaints,
        attendanceAverage,
        recentActivities,
      },
      'Dashboard stats loaded'
    )
  );
});
