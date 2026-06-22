import asyncHandler from 'express-async-handler';
import Subject from '../../models/Subject.js';
import Teacher from '../../models/Teacher.js';
import Student from '../../models/Student.js';
import Attendance from '../../models/Attendance.js';
import Notification from '../../models/Notification.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Helper to fetch teacher profile based on logged-in User _id
 */
const getTeacherProfile = async (userId) => {
  const teacher = await Teacher.findOne({ userId }).lean();
  if (!teacher) {
    throw new ApiError(404, 'Teacher profile not found.');
  }
  return teacher;
};

/**
 * @desc    Get subjects assigned to the logged-in teacher
 * @route   GET /api/teacher/subjects
 * @access  Private/Teacher
 */
export const getAssignedSubjects = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // Find all subjects assigned to this teacher
  const subjects = await Subject.find({ assignedTeacher: teacher._id }).lean();

  // Compile subjects and count enrolled students for each
  const subjectList = [];
  for (const subject of subjects) {
    const totalEnrolledStudents = await Student.countDocuments({
      semester: subject.semester,
      academicSession: subject.academicSession,
      currentStatus: 'active'
    });

    subjectList.push({
      _id: subject._id,
      subjectName: subject.subjectName,
      subjectCode: subject.subjectCode,
      semester: subject.semester,
      creditHours: subject.creditHours,
      academicSession: subject.academicSession,
      totalEnrolledStudents
    });
  }

  res.status(200).json(new ApiResponse(200, subjectList, 'Assigned subjects retrieved successfully'));
});

/**
 * @desc    Get students enrolled in the teacher's assigned subjects
 * @route   GET /api/teacher/students
 * @access  Private/Teacher
 */
export const getStudents = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);

  // Find all subjects assigned to teacher
  const assignedSubjects = await Subject.find({ assignedTeacher: teacher._id }).lean();

  // Map to distinct semester/academicSession pairs
  const orConditions = assignedSubjects.map(s => ({
    semester: s.semester,
    academicSession: s.academicSession
  }));

  if (orConditions.length === 0) {
    return res.status(200).json(new ApiResponse(200, {
      students: [],
      total: 0,
      page: 1,
      pages: 0
    }, 'No assigned subjects, returning zero students.'));
  }

  const query = { currentStatus: 'active' };

  // Enforce ownership restrictions
  const filterConditions = [];

  // If filtering by specific subject
  if (req.query.subject) {
    const targetSubject = assignedSubjects.find(s => s._id.toString() === req.query.subject);
    if (!targetSubject) {
      return next(new ApiError(403, 'You are not assigned to this subject.'));
    }
    filterConditions.push({
      semester: targetSubject.semester,
      academicSession: targetSubject.academicSession
    });
  }

  if (req.query.semester) {
    const sem = Number(req.query.semester);
    // Double check that teacher teaches in this semester
    const teachesSemester = assignedSubjects.some(s => s.semester === sem);
    if (!teachesSemester) {
      return next(new ApiError(403, 'You do not teach any subjects in this semester.'));
    }
    filterConditions.push({ semester: sem });
  }

  if (req.query.academicSession) {
    const session = req.query.academicSession;
    const teachesSession = assignedSubjects.some(s => s.academicSession === session);
    if (!teachesSession) {
      return next(new ApiError(403, 'You do not teach any subjects in this academic session.'));
    }
    filterConditions.push({ academicSession: session });
  }

  // Construct combined query
  if (filterConditions.length > 0) {
    query.$and = [
      { $or: orConditions },
      ...filterConditions
    ];
  } else {
    query.$or = orConditions;
  }

  // Search support (Name, Registration number, Roll number)
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    const searchConditions = {
      $or: [
        { name: searchRegex },
        { registrationNumber: searchRegex },
        { rollNumber: searchRegex }
      ]
    };
    if (query.$and) {
      query.$and.push(searchConditions);
    } else {
      query.$and = [
        { $or: query.$or },
        searchConditions
      ];
      delete query.$or;
    }
  }

  // Pagination & Sorting
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const sortBy = req.query.sortBy || 'name';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  const students = await Student.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
    
  const total = await Student.countDocuments(query);
  const pages = Math.ceil(total / limit);

  res.status(200).json(new ApiResponse(200, {
    students,
    total,
    page,
    pages
  }, 'Students list retrieved successfully'));
});

/**
 * @desc    Upload Attendance (Single Student)
 * @route   POST /api/teacher/attendance
 * @access  Private/Teacher
 */
export const uploadAttendance = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { student: studentId, subject: subjectId, month, year, totalClasses, attendedClasses } = req.body;

  // 1. Verify subject is assigned to this teacher
  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to upload attendance for this subject.'));
  }

  // 2. Verify student exists and belongs to the correct semester and session
  const student = await Student.findOne({ _id: studentId, semester: subject.semester, academicSession: subject.academicSession }).lean();
  if (!student) {
    return next(new ApiError(404, 'Student not found in the subject class roster.'));
  }

  // 3. Prevent duplicate monthly attendance
  const existingAttendance = await Attendance.findOne({
    student: studentId,
    subject: subjectId,
    month,
    year
  }).lean();
  if (existingAttendance) {
    return next(new ApiError(400, `Attendance record already exists for ${month} ${year}.`));
  }

  // 4. Save record (Percentage and lowAttendance warnings calculated pre-save in schema)
  const attendance = await Attendance.create({
    student: studentId,
    subject: subjectId,
    teacher: teacher._id,
    month,
    year,
    totalClasses,
    attendedClasses
  });

  // 5. Notify Student
  await Notification.create({
    receiver: student.userId,
    title: 'Attendance Uploaded',
    message: `Your attendance for ${subject.subjectName} in ${month} ${year} has been uploaded. Attendance: ${attendance.attendancePercentage}%`,
    type: 'attendance'
  });

  // 6. Log Audit
  await logAdminAction(req, `Teacher uploaded attendance for student ${student.name} in subject ${subject.subjectName} (${attendance.attendancePercentage}%)`, 'attendance', student.userId);

  res.status(201).json(new ApiResponse(201, attendance, 'Attendance uploaded successfully'));
});

/**
 * @desc    Update Attendance
 * @route   PUT /api/teacher/attendance/:id
 * @access  Private/Teacher
 */
export const updateAttendance = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { totalClasses, attendedClasses } = req.body;

  // 1. Find attendance record
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) {
    return next(new ApiError(404, 'Attendance record not found.'));
  }

  // 2. Verify ownership (Must be teacher's assigned subject)
  if (attendance.teacher.toString() !== teacher._id.toString()) {
    return next(new ApiError(403, 'You are not authorized to edit this attendance record.'));
  }

  // 3. Update fields
  if (totalClasses !== undefined) attendance.totalClasses = totalClasses;
  if (attendedClasses !== undefined) attendance.attendedClasses = attendedClasses;

  // Save (triggers recalculation pre-save)
  await attendance.save();

  // Fetch student name & subject name for logs/notifications
  const student = await Student.findById(attendance.student).lean();
  const subject = await Subject.findById(attendance.subject).lean();

  // 4. Log Audit
  await logAdminAction(req, `Teacher updated attendance for student ${student?.name || 'N/A'} in subject ${subject?.subjectName || 'N/A'} (${attendance.attendancePercentage}%)`, 'attendance', student?.userId);

  res.status(200).json(new ApiResponse(200, attendance, 'Attendance updated successfully'));
});

/**
 * @desc    Get all attendance records for a subject class roster, filterable by month and year
 * @route   GET /api/teacher/attendance
 * @access  Private/Teacher
 */
export const getAttendanceForSubject = asyncHandler(async (req, res, next) => {
  const teacher = await getTeacherProfile(req.user._id);
  const { subject: subjectId, month, year } = req.query;

  if (!subjectId) {
    return next(new ApiError(400, 'Subject ID is required.'));
  }

  // 1. Verify subject is assigned to this teacher
  const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: teacher._id }).lean();
  if (!subject) {
    return next(new ApiError(403, 'You are not authorized to view attendance for this subject.'));
  }

  // 2. Find all students in this subject class roster
  const students = await Student.find({
    semester: subject.semester,
    academicSession: subject.academicSession,
    currentStatus: 'active'
  }).lean();

  // 3. Find existing attendance for this subject, month, and year
  const query = { subject: subjectId };
  if (month) query.month = month;
  if (year) query.year = Number(year);

  const attendanceRecords = await Attendance.find(query).lean();

  // 4. Map students to include their attendance if it exists
  const studentAttendanceList = students.map((student) => {
    const studentAttendance = attendanceRecords.find(
      (a) => a.student.toString() === student._id.toString()
    );
    return {
      student,
      attendance: studentAttendance || null
    };
  });

  res.status(200).json(new ApiResponse(200, studentAttendanceList, 'Attendance retrieved successfully'));
});
