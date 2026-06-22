import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import User from './models/User.js';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Subject from './models/Subject.js';
import Timetable from './models/Timetable.js';
import Session from './models/Session.js';
import RegistrationNumber from './models/RegistrationNumber.js';
import Notice from './models/Notice.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';

dotenv.config();
process.env.NODE_ENV = 'test';
const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api/admin`;
const AUTH_URL = `http://localhost:${PORT}/api/auth`;

const runAdminTests = async () => {
  console.log('--- STARTING ADMIN MODULE INTEGRATION TESTS ---');

  // 1. Database Connection
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected successfully for admin testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Start HTTP Server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test Admin Server listening on port ${PORT}`);

  // Test identifiers
  const adminMobile = '03112223334';
  const studentMobile = '03112223335';
  const studentMobile2 = '03112223336';
  const teacherMobile = '03112223337';
  const regNumberVal = 'REG-ADM-777';
  const regNumberVal2 = 'REG-ADM-888';
  const rollNumberVal = 'ROLL-ADM-777';
  const rollNumberVal2 = 'ROLL-ADM-888';
  const teacherIdVal = 'TCH-ADM-777';
  const subjectCodeVal = 'CS-ADM-101';
  const sessionNameVal = 'BSCS 2024-2028';

  let adminAccessToken = '';
  let createdStudentId = '';
  let createdTeacherId = '';
  let createdSubjectId = '';

  try {
    // 3. Clear database test items
    await User.deleteMany({ mobileNumber: { $in: [adminMobile, studentMobile, studentMobile2, teacherMobile] } });
    await Student.deleteMany({ registrationNumber: { $in: [regNumberVal, regNumberVal2] } });
    await Teacher.deleteMany({ teacherId: teacherIdVal });
    await Subject.deleteMany({ subjectCode: subjectCodeVal });
    await Timetable.deleteMany({});
    await Session.deleteMany({ sessionName: sessionNameVal });
    await RegistrationNumber.deleteMany({ number: { $in: [regNumberVal, regNumberVal2] } });
    await Notice.deleteMany({ title: 'Important Test Notice' });
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('Test database cleaned.');

    // 4. Create and login Admin User
    console.log('\n[Step 1] Seeding and logging in Admin user...');
    const adminUser = await User.create({
      name: 'Head Admin',
      email: 'admin.cs@gpgc.edu.pk',
      mobileNumber: adminMobile,
      password: 'adminpassword123',
      role: 'admin',
    });

    const loginRes = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: adminMobile,
        password: 'adminpassword123',
      }),
    });
    const loginData = await loginRes.json();
    adminAccessToken = loginData.data.accessToken;
    console.log('Admin logged in. Token retrieved.');

    // 5. Pre-approve Student Registration Numbers
    console.log('\n[Step 2] Uploading allowed student registration numbers...');
    const uploadRegRes = await fetch(`${BASE_URL}/registration-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        numbers: [regNumberVal, regNumberVal2],
      }),
    });
    const uploadRegData = await uploadRegRes.json();
    console.log('Reg Number Upload Response:', JSON.stringify(uploadRegData, null, 2));
    if (uploadRegRes.status !== 200) throw new Error('Registration numbers upload failed!');

    // 6. Add Student Profile
    console.log('\n[Step 3] Adding student (should link User and Student models)...');
    const addStudentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Jane Student',
        email: 'jane.student@gpgc.edu.pk',
        mobileNumber: studentMobile,
        password: 'studentpassword123',
        registrationNumber: regNumberVal,
        rollNumber: rollNumberVal,
        semester: 2,
        academicSession: sessionNameVal,
        address: 'Lakki Marwat',
      }),
    });
    const addStudentData = await addStudentRes.json();
    console.log('Add Student Response:', JSON.stringify(addStudentData, null, 2));
    if (addStudentRes.status !== 201) throw new Error('Add student failed!');
    createdStudentId = addStudentData.data.studentId;

    // Check if RegistrationNumber is marked as used
    const regCheckObj = await RegistrationNumber.findOne({ number: regNumberVal });
    console.log('Reg number isUsed status:', regCheckObj.isUsed);
    if (!regCheckObj.isUsed) throw new Error('Reg number was not marked as used!');

    // 7. Add Student 2 for promotion tests
    await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Bob Student',
        email: 'bob.student@gpgc.edu.pk',
        mobileNumber: studentMobile2,
        password: 'studentpassword123',
        registrationNumber: regNumberVal2,
        rollNumber: rollNumberVal2,
        semester: 2,
        academicSession: sessionNameVal,
        address: 'Peshawar',
      }),
    });

    // 8. Edit Student
    console.log('\n[Step 4] Modifying student details...');
    const editStudentRes = await fetch(`${BASE_URL}/students/${createdStudentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        semester: 3,
        address: 'Bannu',
      }),
    });
    const editStudentData = await editStudentRes.json();
    console.log('Edit Student Response:', JSON.stringify(editStudentData, null, 2));
    if (editStudentRes.status !== 200 || editStudentData.data.address !== 'Bannu') {
      throw new Error('Edit student failed!');
    }

    // 9. Block Student (Instant logout)
    console.log('\n[Step 5] Blocking student account...');
    const blockRes = await fetch(`${BASE_URL}/students/${createdStudentId}/block`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const blockData = await blockRes.json();
    console.log('Block student response:', JSON.stringify(blockData, null, 2));

    const blockedUserObj = await User.findOne({ mobileNumber: studentMobile });
    console.log('Blocked User isBlocked status:', blockedUserObj.isBlocked);
    if (!blockedUserObj.isBlocked) throw new Error('Student was not blocked in database!');

    // Unblock Student for further tests
    await fetch(`${BASE_URL}/students/${createdStudentId}/unblock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });

    // 10. Add Teacher Profile
    console.log('\n[Step 6] Adding teacher...');
    const addTeacherRes = await fetch(`${BASE_URL}/teachers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Prof. Alice Teacher',
        email: 'alice.teacher@gpgc.edu.pk',
        mobileNumber: teacherMobile,
        password: 'teacherpassword123',
        teacherId: teacherIdVal,
        qualification: 'MS Computer Science',
        designation: 'Lecturer',
      }),
    });
    const addTeacherData = await addTeacherRes.json();
    console.log('Add Teacher Response:', JSON.stringify(addTeacherData, null, 2));
    if (addTeacherRes.status !== 201) throw new Error('Add teacher failed!');
    createdTeacherId = addTeacherData.data.teacherProfileId;

    // 11. Create Subject
    console.log('\n[Step 7] Creating subject...');
    const createSubjectRes = await fetch(`${BASE_URL}/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        subjectName: 'Object Oriented Programming',
        subjectCode: subjectCodeVal,
        semester: 3,
        creditHours: 4,
        academicSession: sessionNameVal,
      }),
    });
    const createSubjectData = await createSubjectRes.json();
    console.log('Create Subject Response:', JSON.stringify(createSubjectData, null, 2));
    if (createSubjectRes.status !== 201) throw new Error('Create subject failed!');
    createdSubjectId = createSubjectData.data._id;

    // 12. Assign Teacher to Subject
    console.log('\n[Step 8] Assigning teacher to subject...');
    const assignRes = await fetch(`${BASE_URL}/subjects/${createdSubjectId}/assign-teacher`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        teacherId: createdTeacherId,
      }),
    });
    const assignData = await assignRes.json();
    console.log('Assign Teacher Response:', JSON.stringify(assignData, null, 2));
    if (assignRes.status !== 200) throw new Error('Teacher assignment failed!');

    // Check if Teacher document is updated
    const teacherCheckObj = await Teacher.findById(createdTeacherId);
    console.log('Teacher assigned subjects list length:', teacherCheckObj.subjects.length);
    if (teacherCheckObj.subjects.length !== 1) throw new Error('Subject was not mapped in Teacher document!');

    // 13. Create Timetable Slot
    console.log('\n[Step 9] Creating timetable entry...');
    const timetableRes = await fetch(`${BASE_URL}/timetable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        semester: 3,
        subject: createdSubjectId,
        teacher: createdTeacherId,
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:30',
        roomNumber: 'Room-A',
      }),
    });
    const timetableData = await timetableRes.json();
    console.log('Create Timetable Response:', JSON.stringify(timetableData, null, 2));
    if (timetableRes.status !== 201) throw new Error('Create timetable entry failed!');

    // 14. Conflict Testing - Overlap
    console.log('\n[Step 10] Testing timetable double-booking conflict detection...');
    const duplicateTimetableRes = await fetch(`${BASE_URL}/timetable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        semester: 3,
        subject: createdSubjectId,
        teacher: createdTeacherId,
        day: 'Monday',
        startTime: '09:30', // Overlaps with 09:00 - 10:30
        endTime: '11:00',
        roomNumber: 'Room-A', // Same room
      }),
    });
    const duplicateTimetableData = await duplicateTimetableRes.json();
    console.log('Conflict Overlap Status Code:', duplicateTimetableRes.status);
    console.log('Conflict Overlap Response:', JSON.stringify(duplicateTimetableData, null, 2));
    if (duplicateTimetableRes.status !== 400 || duplicateTimetableData.success) {
      throw new Error('Conflict detection bypassed! It should block timetable overlaps.');
    }

    // 15. Create Session
    console.log('\n[Step 11] Creating academic session...');
    const sessionRes = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        sessionName: sessionNameVal,
        startYear: 2024,
        endYear: 2028,
      }),
    });
    const sessionData = await sessionRes.json();
    console.log('Create Session Response:', JSON.stringify(sessionData, null, 2));

    // 16. Promote Students in Academic Session
    console.log('\n[Step 12] Promoting all students in session from semester 3 to 4...');
    // Currently, our student 1 is in semester 3 (after edit) and student 2 is in semester 2 (still 2).
    // Let's promote semester 3 students. Student 1 should go to semester 4.
    const promoteRes = await fetch(`${BASE_URL}/promote-semester`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        academicSession: sessionNameVal,
        currentSemester: 3,
      }),
    });
    const promoteData = await promoteRes.json();
    console.log('Promote Semester Response:', JSON.stringify(promoteData, null, 2));
    if (promoteRes.status !== 200 || promoteData.data.promotedCount !== 1) {
      throw new Error('Semester promotion failed!');
    }

    // Check if AuditLog registered the promotion action
    const promotionLogsCount = await AuditLog.countDocuments({ module: 'session' });
    console.log('Number of session promotion audit logs:', promotionLogsCount);
    if (promotionLogsCount === 0) throw new Error('Semester promotion did not log audit record!');

    // 17. Create Announcement Notice Board
    console.log('\n[Step 13] Creating target announcement notice...');
    const noticeRes = await fetch(`${BASE_URL}/notices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Important Test Notice',
        description: 'Class scheduling has updated.',
        targetAudience: 'students',
      }),
    });
    const noticeData = await noticeRes.json();
    console.log('Create Notice Response:', JSON.stringify(noticeData, null, 2));

    // Verify Notification documents were generated for students
    const notificationsCount = await Notification.countDocuments({ type: 'notice' });
    console.log('Number of notices in notification collection:', notificationsCount);
    if (notificationsCount === 0) throw new Error('Notice creation did not yield notifications!');

    // 18. Retrieve Dashboard Aggregate Metrics
    console.log('\n[Step 14] Querying dashboard stats...');
    const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const dashboardData = await dashboardRes.json();
    console.log('Dashboard Data Response:', JSON.stringify(dashboardData.data, null, 2));
    if (dashboardRes.status !== 200) throw new Error('Dashboard stats lookup failed!');

    // 19. Export Students Data as CSV
    console.log('\n[Step 15] Exporting students to CSV...');
    const exportRes = await fetch(`${BASE_URL}/export/students`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const csvContent = await exportRes.text();
    console.log('Export CSV Status Code:', exportRes.status);
    console.log('Export CSV Headers (Content-Type):', exportRes.headers.get('content-type'));
    console.log('Export CSV Payload Sample (First 2 Lines):\n', csvContent.split('\n').slice(0, 2).join('\n'));
    if (exportRes.status !== 200 || !csvContent.startsWith('Name,Registration Number')) {
      throw new Error('Export CSV students failed!');
    }

    console.log('\n--- ALL ADMIN MODULE INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('\n--- TEST FAILED! ---');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    // 20. Clean up test data
    console.log('\nCleaning up database test records...');
    await User.deleteMany({ mobileNumber: { $in: [adminMobile, studentMobile, studentMobile2, teacherMobile] } });
    await Student.deleteMany({ registrationNumber: { $in: [regNumberVal, regNumberVal2] } });
    await Teacher.deleteMany({ teacherId: teacherIdVal });
    await Subject.deleteMany({ subjectCode: subjectCodeVal });
    await Timetable.deleteMany({});
    await Session.deleteMany({ sessionName: sessionNameVal });
    await RegistrationNumber.deleteMany({ number: { $in: [regNumberVal, regNumberVal2] } });
    await Notice.deleteMany({ title: 'Important Test Notice' });
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');

    server.close(() => {
      console.log('Test HTTP server closed. Exiting test script.');
      process.exit();
    });
  }
};

runAdminTests();
