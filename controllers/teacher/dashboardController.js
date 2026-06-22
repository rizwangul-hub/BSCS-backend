import asyncHandler from 'express-async-handler';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import Student from '../../models/Student.js';
import Complaint from '../../models/Complaint.js';
import Attendance from '../../models/Attendance.js';
import AuditLog from '../../models/AuditLog.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Helper to fetch teacher profile
 */
const getTeacherProfile = async (userId) => {
  const teacher = await Teacher.findOne({ userId }).lean();
  if (!teacher) {
    throw new ApiError(404, 'Teacher profile not found.');
  }
  return teacher;
};

/**
 * @desc    Get Teacher Dashboard Analytics
 * @route   GET /api/teacher/dashboard
 * @access  Private/Teacher
 */
export const getTeacherDashboardStats = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // 1. Total Subjects assigned to teacher
  const assignedSubjects = await Subject.find({ assignedTeacher: teacher._id }).lean();
  const totalSubjects = assignedSubjects.length;

  // Distinct semester and session filters to identify teaching scope
  const scopeConditions = assignedSubjects.map(s => ({
    semester: s.semester,
    academicSession: s.academicSession
  }));

  let totalStudents = 0;
  let pendingComplaints = 0;
  let lowAttendanceStudents = 0;
  let recentActivities = [];

  if (scopeConditions.length > 0) {
    // 2. Count active students within scope
    totalStudents = await Student.countDocuments({
      $or: scopeConditions,
      currentStatus: 'active'
    });

    // 3. Pending Complaints from these students
    const studentsInScope = await Student.find({
      $or: scopeConditions,
      currentStatus: 'active'
    }).lean();
    const studentIds = studentsInScope.map(s => s._id);

    pendingComplaints = await Complaint.countDocuments({
      student: { $in: studentIds },
      status: 'pending'
    });

    // 4. Low Attendance Students: count of unique students having < 75% attendance in teacher's subjects
    const lowAttendanceRecords = await Attendance.find({
      teacher: teacher._id,
      lowAttendance: true
    }).distinct('student');
    lowAttendanceStudents = lowAttendanceRecords.length;
  }

  // 5. Recent Activities (Last 5 audit logs performed by this teacher)
  recentActivities = await AuditLog.find({ performedBy: req.user._id })
    .sort({ timestamp: -1 })
    .limit(5)
    .lean();

  const stats = {
    totalSubjects,
    totalStudents,
    pendingComplaints,
    lowAttendanceStudents,
    recentActivities
  };

  res.status(200).json(new ApiResponse(200, stats, 'Teacher dashboard stats compiled successfully'));
});
