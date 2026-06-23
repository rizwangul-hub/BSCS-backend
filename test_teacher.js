import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import xlsx from 'xlsx';
import app from './app.js';
import User from './models/User.js';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Subject from './models/Subject.js';
import Attendance from './models/Attendance.js';
import Marks from './models/Marks.js';
import Complaint from './models/Complaint.js';
import Assignment from './models/Assignment.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';

import connectDB from './config/db.js';

dotenv.config();
process.env.NODE_ENV = 'test';
const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}/api/teacher`;
const AUTH_URL = `http://localhost:${PORT}/api/auth`;

const runTeacherTests = async () => {
  console.log('--- STARTING TEACHER MODULE INTEGRATION TESTS ---');

  // 1. Database Connection
  try {
    await connectDB();
    console.log('MongoDB Connected successfully for teacher testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Start HTTP Server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test Teacher Server listening on port ${PORT}`);

  // Test data identifiers
  const teacherMobile = '03221234567';
  const studentMobile = '03221234568';
  const outsiderStudentMobile = '03221234569';

  const regNo = 'REG-TCH-111';
  const rollNo = 'ROLL-TCH-111';
  const outsiderRegNo = 'REG-TCH-999';
  const outsiderRollNo = 'ROLL-TCH-999';

  let teacherToken = '';
  let studentDocId = '';
  let outsiderStudentDocId = '';
  let subjectDocId = '';
  let teacherDocId = '';
  let complaintDocId = '';
  let attendanceRecordId = '';
  let marksRecordId = '';

  try {
    // 3. Clear database test items
    await User.deleteMany({ mobileNumber: { $in: [teacherMobile, studentMobile, outsiderStudentMobile] } });
    await Student.deleteMany({ registrationNumber: { $in: [regNo, outsiderRegNo] } });
    await Teacher.deleteMany({ mobile: teacherMobile });
    await Subject.deleteMany({ subjectCode: { $in: ['CS-TCH-101', 'CS-TCH-OUT'] } });
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
    await Complaint.deleteMany({});
    await Assignment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('Database cleaned.');

    // 4. Create and seed Users & Profiles
    console.log('\n[Step 1] Seeding database accounts...');
    
    // Teacher User & Profile
    const teacherUser = await User.create({
      name: 'Professor Idris',
      email: 'idris.teacher@gpgc.edu.pk',
      mobileNumber: teacherMobile,
      password: 'teacherpassword123',
      role: 'teacher'
    });

    const teacherProfile = await Teacher.create({
      userId: teacherUser._id,
      teacherId: 'TCH-TEST-888',
      qualification: 'M.S. Computer Science',
      designation: 'Associate Professor',
      mobile: teacherMobile,
      department: 'Computer Science'
    });
    teacherDocId = teacherProfile._id;

    // Assigned Subject
    const subject = await Subject.create({
      subjectName: 'Object Oriented Programming',
      subjectCode: 'CS-TCH-101',
      semester: 3,
      creditHours: 4,
      assignedTeacher: teacherProfile._id,
      academicSession: 'BSCS 2024-2028'
    });
    subjectDocId = subject._id;

    // Assign Subject to Teacher subjects list
    teacherProfile.subjects.push(subject._id);
    await teacherProfile.save();

    // Student 1 (Enrolled in OOP Class)
    const studentUser = await User.create({
      name: 'Adnan Shah',
      email: 'adnan.student@gpgc.edu.pk',
      mobileNumber: studentMobile,
      password: 'studentpassword123',
      role: 'student'
    });

    const studentProfile = await Student.create({
      userId: studentUser._id,
      name: 'Adnan Shah',
      registrationNumber: regNo,
      rollNumber: rollNo,
      semester: 3,
      academicSession: 'BSCS 2024-2028',
      mobile: studentMobile
    });
    studentDocId = studentProfile._id;

    // Student 2 (Outsider student - Semester 4, not in teacher's class scope)
    const outsiderStudentUser = await User.create({
      name: 'Sajid Outsider',
      email: 'sajid.outsider@gpgc.edu.pk',
      mobileNumber: outsiderStudentMobile,
      password: 'studentpassword123',
      role: 'student'
    });

    const outsiderStudentProfile = await Student.create({
      userId: outsiderStudentUser._id,
      name: 'Sajid Outsider',
      registrationNumber: outsiderRegNo,
      rollNumber: outsiderRollNo,
      semester: 4,
      academicSession: 'BSCS 2024-2028',
      mobile: outsiderStudentMobile
    });
    outsiderStudentDocId = outsiderStudentProfile._id;

    // 5. Authenticate Teacher
    console.log('\n[Step 2] Authenticating teacher user...');
    const loginRes = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: teacherMobile,
        password: 'teacherpassword123'
      })
    });
    const loginData = await loginRes.json();
    teacherToken = loginData.data.accessToken;
    console.log('Teacher authenticated. JWT retrieved.');

    // 6. Test 1: Get Assigned Subjects
    console.log('\n[Test 1] Fetching assigned subjects...');
    const subjectsRes = await fetch(`${BASE_URL}/subjects`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const subjectsData = await subjectsRes.json();
    console.log('Subjects Status:', subjectsRes.status);
    console.log('Subject list response sample:', subjectsData.data[0]);
    if (subjectsRes.status !== 200 || subjectsData.data[0].subjectCode !== 'CS-TCH-101' || subjectsData.data[0].totalEnrolledStudents !== 1) {
      throw new Error('Test 1 failed.');
    }
    console.log('SUCCESS: Get Assigned Subjects returned correct enrollment metrics.');

    // 7. Test 2: Get Students
    console.log('\n[Test 2] Fetching enrolled students...');
    const studentsRes = await fetch(`${BASE_URL}/students?subject=${subjectDocId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const studentsData = await studentsRes.json();
    console.log('Students status:', studentsRes.status);
    console.log('Students list count:', studentsData.data.students.length);
    console.log('Student record name:', studentsData.data.students[0]?.name);
    // Student Sajid (outsider) must NOT be returned
    const containsOutsider = studentsData.data.students.some(s => s._id.toString() === outsiderStudentDocId.toString());
    if (studentsRes.status !== 200 || studentsData.data.students.length !== 1 || containsOutsider) {
      throw new Error('Test 2 failed. Access restrictions bypassed or incorrect students retrieved.');
    }
    console.log('SUCCESS: Enrolled student retrieved and outsider student blocked.');

    // 8. Test 3: Upload Attendance
    console.log('\n[Test 3] Uploading attendance for student...');
    const uploadAttRes = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        student: studentDocId,
        subject: subjectDocId,
        month: 'October',
        year: 2026,
        totalClasses: 20,
        attendedClasses: 14 // 14 / 20 = 70% (<75%, should set lowAttendance = true)
      })
    });
    const uploadAttData = await uploadAttRes.json();
    console.log('Upload Attendance Status:', uploadAttRes.status);
    console.log('Attendance percentage calculated:', uploadAttData.data.attendancePercentage);
    console.log('lowAttendance flag set:', uploadAttData.data.lowAttendance);
    if (uploadAttRes.status !== 201 || uploadAttData.data.attendancePercentage !== 70 || !uploadAttData.data.lowAttendance) {
      throw new Error('Test 3 failed.');
    }
    attendanceRecordId = uploadAttData.data._id;
    console.log('SUCCESS: Attendance uploaded and warning flag auto-assigned.');

    // 9. Test 4: Upload Duplicate Attendance
    console.log('\n[Test 4] Testing duplicate attendance constraint...');
    const dupAttRes = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        student: studentDocId,
        subject: subjectDocId,
        month: 'October',
        year: 2026,
        totalClasses: 20,
        attendedClasses: 18
      })
    });
    const dupAttData = await dupAttRes.json();
    console.log('Duplicate status code:', dupAttRes.status);
    if (dupAttRes.status !== 400) {
      throw new Error('Test 4 failed. Duplicate attendance should return 400.');
    }
    console.log('SUCCESS: Duplicate attendance blocked successfully.');

    // 10. Test 5: Upload Invalid Range Attendance
    console.log('\n[Test 5] Testing attendance validator ranges...');
    const invalidAttRes = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        student: studentDocId,
        subject: subjectDocId,
        month: 'October',
        year: 2026,
        totalClasses: 20,
        attendedClasses: 25 // Invalid: attended > total
      })
    });
    console.log('Invalid attendance status:', invalidAttRes.status);
    if (invalidAttRes.status !== 422) {
      throw new Error('Test 5 failed. Range error should return 422.');
    }
    console.log('SUCCESS: Attendance range check block verified.');

    // 11. Test 6: Upload Marks & Verify Grade pre-save calculations
    console.log('\n[Test 6] Uploading marks...');
    const addMarksRes = await fetch(`${BASE_URL}/marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        student: studentDocId,
        subject: subjectDocId,
        semester: 3,
        midMarks: 27,        // Out of 30
        presentation: 5,     // Out of 5
        test1: 5,            // Out of 5
        test2: 5,            // Out of 5
        assignment: 5,       // Out of 5
        quiz: 5,             // Out of 5
        attendanceMarks: 5   // Out of 5
        // Total = 27 + Math.min(20, (5*6)) = 47. Percentage = 47/50 * 100 = 94%. Grade should be 'A'
      })
    });
    const addMarksData = await addMarksRes.json();
    console.log('Add Marks Status:', addMarksRes.status);
    console.log('Calculated percentage:', addMarksData.data.percentage);
    console.log('Calculated grade:', addMarksData.data.grade);
    if (addMarksRes.status !== 201 || addMarksData.data.percentage !== 94 || addMarksData.data.grade !== 'A') {
      throw new Error('Test 6 failed.');
    }
    marksRecordId = addMarksData.data._id;
    console.log('SUCCESS: Marks uploaded and sessional calculations match Grade A (94%).');

    // 12. Test 7: Attempt Upload Marks for Outsider
    console.log('\n[Test 7] Attempting unauthorized marks upload...');
    const unauthorizedMarksRes = await fetch(`${BASE_URL}/marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        student: outsiderStudentDocId, // outsider student
        subject: subjectDocId,
        semester: 4,
        midMarks: 20
      })
    });
    console.log('Unauthorized marks status:', unauthorizedMarksRes.status);
    if (unauthorizedMarksRes.status !== 404) { // Returns 404 because student doesn't match subject class roster
      throw new Error('Test 7 failed. Unauthorized student marks upload must fail.');
    }
    console.log('SUCCESS: Blocked unauthorized student marks upload.');

    // 13. Test 8: Reply Complaint
    console.log('\n[Test 8] Seeding and replying to a complaint...');
    const complaint = await Complaint.create({
      student: studentDocId,
      message: 'Need clarification on sessional presentation marks.'
    });
    complaintDocId = complaint._id;

    const replyRes = await fetch(`${BASE_URL}/complaints/${complaintDocId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        reply: 'Please meet me in the department tomorrow during office hours.'
      })
    });
    const replyData = await replyRes.json();
    console.log('Reply Complaint Status:', replyRes.status);
    console.log('Resolved Status:', replyData.data.status);
    console.log('repliedBy saved:', replyData.data.repliedBy);
    if (replyRes.status !== 200 || replyData.data.status !== 'resolved' || !replyData.data.repliedBy) {
      throw new Error('Test 8 failed.');
    }
    console.log('SUCCESS: Complaint replied and notification dispatched.');

    // 14. Test 9: Download Template
    console.log('\n[Test 9] Downloading marks template...');
    const templateRes = await fetch(`${BASE_URL}/marks/template`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    console.log('Template status:', templateRes.status);
    console.log('Content-Type Header:', templateRes.headers.get('content-type'));
    if (templateRes.status !== 200 || !templateRes.headers.get('content-type').includes('sheet')) {
      throw new Error('Test 9 failed.');
    }
    console.log('SUCCESS: Template Excel generated successfully.');

    // 15. Test 10: Bulk Excel Upload
    console.log('\n[Test 10] Testing bulk Excel marks upload...');
    
    // Construct inline xlsx file buffer using xlsx library
    const uploadData = [
      {
        registrationNumber: regNo, // Active student
        midMarks: 24,
        presentation: 4,
        test1: 3,
        test2: 4,
        assignment: 4,
        quiz: 4,
        attendanceMarks: 5
      },
      {
        registrationNumber: outsiderRegNo, // Outsider student (semester 4, should fail)
        midMarks: 20,
        presentation: 3,
        test1: 3,
        test2: 3,
        assignment: 3,
        quiz: 3,
        attendanceMarks: 3
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(uploadData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Marks Upload');
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Mock multipart/form-data upload using global fetch and FormData
    const formData = new FormData();
    formData.append('subject', subjectDocId);
    formData.append('semester', '3');
    // Using a blob representation for the file field
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'marks.xlsx');

    const excelUploadRes = await fetch(`${BASE_URL}/marks/upload-excel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${teacherToken}`
      },
      body: formData
    });
    const excelUploadData = await excelUploadRes.json();
    console.log('Excel Upload Status:', excelUploadRes.status);
    console.log('Successful rows count:', excelUploadData.data.successful.length);
    console.log('Failed rows count:', excelUploadData.data.failed.length);
    console.log('Failure reason sample:', excelUploadData.data.failed[0]?.reason);
    
    // Note: Student 1 (regNo) already has marks seeded in Test 6, so they should fail with duplicate record.
    // Student 2 (outsiderRegNo) is semester 4, so they should fail semester validation.
    // Hence, successful = 0, failed = 2. This is correct!
    if (excelUploadRes.status !== 200 || excelUploadData.data.successful.length !== 0 || excelUploadData.data.failed.length !== 2) {
      throw new Error('Test 10 failed.');
    }
    console.log('SUCCESS: Excel sheet parsed. Invalid row skipped and duplication blocked.');

    // 16. Test 11: Get Dashboard Stats
    console.log('\n[Test 11] Retrieving dashboard statistics...');
    const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const dashboardData = await dashboardRes.json();
    console.log('Dashboard Status:', dashboardRes.status);
    console.log('Total Subjects:', dashboardData.data.totalSubjects);
    console.log('Total Students:', dashboardData.data.totalStudents);
    console.log('Low Attendance count:', dashboardData.data.lowAttendanceStudents);
    console.log('Recent activity count:', dashboardData.data.recentActivities.length);
    if (dashboardRes.status !== 200 || dashboardData.data.totalSubjects !== 1 || dashboardData.data.totalStudents !== 1 || dashboardData.data.lowAttendanceStudents !== 1) {
      throw new Error('Test 11 failed.');
    }
    console.log('SUCCESS: Dashboard KPIs aggregated correctly.');

    console.log('\n--- ALL TEACHER INTEGRATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILURE:', error.message);
    process.exit(1);
  } finally {
    // Cleanup databases
    await User.deleteMany({ mobileNumber: { $in: [teacherMobile, studentMobile, outsiderStudentMobile] } });
    await Student.deleteMany({ registrationNumber: { $in: [regNo, outsiderRegNo] } });
    await Teacher.deleteMany({ mobile: teacherMobile });
    await Subject.deleteMany({ subjectCode: { $in: ['CS-TCH-101', 'CS-TCH-OUT'] } });
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
    await Complaint.deleteMany({});
    await Assignment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('Test database cleaned up.');

    // Shutdown
    mongoose.connection.close();
    server.close();
    console.log('HTTP Server closed. Test script finished.');
  }
};

runTeacherTests();
