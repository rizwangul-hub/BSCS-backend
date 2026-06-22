import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import { initSocket } from './sockets/socketService.js';
import User from './models/User.js';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Subject from './models/Subject.js';
import Attendance from './models/Attendance.js';
import Marks from './models/Marks.js';
import Complaint from './models/Complaint.js';
import RegistrationNumber from './models/RegistrationNumber.js';
import { io as Client } from 'socket.io-client';

dotenv.config();
process.env.NODE_ENV = 'test';
const PORT = 5005;

const runTests = async () => {
  console.log('=== STARTING SECURITY & EXPORTS INTEGRATION TESTS ===');

  // 1. Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected successfully for security & exports testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Start HTTP & Socket.IO server
  const server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  // Test data values
  const adminMobile = '03991112221';
  const studentMobile = '03991112222';
  const teacherMobile = '03991112223';
  const studentReg = 'REG-SEC-999';
  const studentRoll = 'ROLL-SEC-999';
  const teacherIdVal = 'TCH-SEC-999';
  const subjectCodeVal = 'CS-SEC-999';

  let adminToken = '';
  let studentToken = '';
  let studentUserId = '';
  let studentProfileId = '';
  let teacherProfileId = '';
  let subjectId = '';

  try {
    // 3. Clear database test items
    await User.deleteMany({ mobileNumber: { $in: [adminMobile, studentMobile, teacherMobile] } });
    await Student.deleteMany({ registrationNumber: studentReg });
    await Teacher.deleteMany({ teacherId: teacherIdVal });
    await Subject.deleteMany({ subjectCode: subjectCodeVal });
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
    await Complaint.deleteMany({});
    await RegistrationNumber.deleteMany({ number: studentReg });
    console.log('Database clean-up finished.');

    // 4. Pre-approve Student Registration Number
    await RegistrationNumber.create({ number: studentReg });
    console.log('Pre-approved student registration number.');

    // 5. Seed Users & Profiles
    // Seed Admin
    const adminUser = await User.create({
      name: 'Security Admin',
      email: 'admin.sec@gpgc.edu.pk',
      mobileNumber: adminMobile,
      password: 'adminpassword123',
      role: 'admin',
    });

    // Seed Student User & Profile
    const studentUser = await User.create({
      name: 'Jane Security Student',
      email: 'jane.student.sec@gpgc.edu.pk',
      mobileNumber: studentMobile,
      password: 'studentpassword123',
      role: 'student',
    });
    studentUserId = studentUser._id;

    const studentProfile = await Student.create({
      userId: studentUser._id,
      name: studentUser.name,
      registrationNumber: studentReg,
      rollNumber: studentRoll,
      semester: 4,
      academicSession: 'BSCS 2024-2028',
      mobile: studentMobile,
    });
    studentProfileId = studentProfile._id;

    // Seed Teacher User & Profile
    const teacherUser = await User.create({
      name: 'Dr. John Security Teacher',
      email: 'john.teacher.sec@gpgc.edu.pk',
      mobileNumber: teacherMobile,
      password: 'teacherpassword123',
      role: 'teacher',
    });

    const teacherProfile = await Teacher.create({
      userId: teacherUser._id,
      teacherId: teacherIdVal,
      qualification: 'PhD CS',
      designation: 'Assistant Professor',
      mobile: teacherMobile,
    });
    teacherProfileId = teacherProfile._id;

    // Seed Subject and link Teacher
    const subject = await Subject.create({
      subjectName: 'Security Architecture',
      subjectCode: subjectCodeVal,
      semester: 4,
      creditHours: 3,
      academicSession: 'BSCS 2024-2028',
      assignedTeacher: teacherProfile._id,
    });
    subjectId = subject._id;

    teacherProfile.subjects.push(subject._id);
    await teacherProfile.save();

    // Seed Attendance
    await Attendance.create({
      student: studentProfile._id,
      subject: subject._id,
      teacher: teacherProfile._id,
      month: 'June',
      year: 2026,
      totalClasses: 20,
      attendedClasses: 18,
    });

    // Seed Marks
    await Marks.create({
      student: studentProfile._id,
      subject: subject._id,
      teacher: teacherProfile._id,
      semester: 4,
      midMarks: 15,
      presentation: 4,
      test1: 4,
      test2: 4,
      assignment: 4,
      quiz: 4,
      attendanceMarks: 5,
    });

    // Seed Complaint
    await Complaint.create({
      student: studentProfile._id,
      message: 'Testing exports database compliance grievance',
      status: 'pending',
    });

    console.log('Seeded Admin, Student, Teacher, Subject, Attendance, Marks, and Complaints.');

    // 6. Get JWT Access Tokens
    const getTokens = async () => {
      const login = async (mobile, password) => {
        const res = await fetch(`http://localhost:${PORT}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: mobile, password }),
        });
        const data = await res.json();
        return data.data.accessToken;
      };

      adminToken = await login(adminMobile, 'adminpassword123');
      studentToken = await login(studentMobile, 'studentpassword123');
      console.log('Successfully retrieved JWT access tokens.');
    };

    await getTokens();

    // ==========================================
    // TEST 1: JWT Socket Handshake Authentication
    // ==========================================
    console.log('\n[TEST 1] Testing Socket.IO JWT Handshake guards...');
    
    // Test 1a: Attempt connection without token
    await new Promise((resolve) => {
      const client = Client(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        autoConnect: false,
      });
      client.connect();
      client.on('connect_error', (err) => {
        console.log('SUCCESS: Connection refused without token, error:', err.message);
        client.close();
        resolve();
      });
    });

    // Test 1b: Attempt connection with invalid token
    await new Promise((resolve) => {
      const client = Client(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        auth: { token: 'invalid-token-value' },
        autoConnect: false,
      });
      client.connect();
      client.on('connect_error', (err) => {
        console.log('SUCCESS: Connection refused with invalid token, error:', err.message);
        client.close();
        resolve();
      });
    });

    // Test 1c: Connect successfully with valid student token
    let studentClient;
    await new Promise((resolve, reject) => {
      studentClient = Client(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        auth: { token: studentToken },
        autoConnect: false,
      });
      studentClient.connect();
      studentClient.on('connect', () => {
        console.log('SUCCESS: Connected to Socket.IO successfully using valid student token.');
        resolve();
      });
      studentClient.on('connect_error', (err) => {
        reject(new Error(`Failed to connect with student token: ${err.message}`));
      });
    });

    // ==========================================
    // TEST 2: Socket Termination on Block
    // ==========================================
    console.log('\n[TEST 2] Testing Session Revocation and Socket Termination on Block...');

    let forceLogoutReceived = false;
    let socketDisconnected = false;

    await new Promise(async (resolve, reject) => {
      studentClient.on('forceLogout', (data) => {
        console.log('SUCCESS: forceLogout event received by client:', data.message);
        forceLogoutReceived = true;
      });

      studentClient.on('disconnect', (reason) => {
        console.log('SUCCESS: Socket disconnected from server, reason:', reason);
        socketDisconnected = true;
        resolve();
      });

      // Call blockStudent API via Admin token
      console.log('Admin calling blockStudent endpoint...');
      const blockRes = await fetch(`http://localhost:${PORT}/api/admin/students/${studentProfileId}/block`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (blockRes.status !== 200) {
        reject(new Error(`Failed to block student: ${blockRes.status}`));
      }
    });

    // Verify student user in DB has incremented tokenVersion and isBlocked flag
    const updatedStudentUser = await User.findById(studentUserId);
    console.log('Updated user status:');
    console.log(' - isBlocked:', updatedStudentUser.isBlocked);
    console.log(' - tokenVersion:', updatedStudentUser.tokenVersion);
    if (updatedStudentUser.isBlocked === true && updatedStudentUser.tokenVersion > 0) {
      console.log('SUCCESS: User tokenVersion incremented and block flag set.');
    } else {
      throw new Error('User blocking verification failed.');
    }

    // Try to hit a protected API with the student's old token
    console.log('Attempting to use revoked student token on GET /api/student/dashboard...');
    const dashboardRes = await fetch(`http://localhost:${PORT}/api/student/dashboard`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });
    console.log('Revoked token API request status:', dashboardRes.status);
    const dashboardError = await dashboardRes.json();
    console.log('Revoked token error message:', dashboardError.message);
    if (dashboardRes.status === 401 || dashboardRes.status === 403) {
      console.log('SUCCESS: Revoked token was correctly rejected by API auth middleware.');
    } else {
      throw new Error('Revoked token was not rejected by API.');
    }

    // Unblock the student so we can test the other student APIs
    console.log('Unblocking student to allow student portal tests...');
    await fetch(`http://localhost:${PORT}/api/admin/students/${studentProfileId}/unblock`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    // Log in student again to get a fresh token
    const freshRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: studentMobile, password: 'studentpassword123' }),
    });
    const freshData = await freshRes.json();
    studentToken = freshData.data.accessToken;
    console.log('Obtained fresh student token.');

    // ==========================================
    // TEST 3: Multi-format Stream Exports
    // ==========================================
    console.log('\n[TEST 3] Testing Multi-format Exports (CSV, XLSX, PDF)...');

    const testExportFormat = async (domain, format, expectedType) => {
      const res = await fetch(`http://localhost:${PORT}/api/admin/export/${domain}?format=${format}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const contentType = res.headers.get('Content-Type');
      console.log(` - GET /export/${domain}?format=${format} -> status ${res.status}, Content-Type: ${contentType}`);
      
      if (res.status !== 200) {
        throw new Error(`Export failed for ${domain} as ${format}: status ${res.status}`);
      }

      if (!contentType.includes(expectedType)) {
        throw new Error(`Invalid content type for ${domain} as ${format}: expected ${expectedType}, got ${contentType}`);
      }
    };

    // Test Students
    await testExportFormat('students', 'csv', 'text/csv');
    await testExportFormat('students', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await testExportFormat('students', 'pdf', 'application/pdf');

    // Test Attendance
    await testExportFormat('attendance', 'csv', 'text/csv');
    await testExportFormat('attendance', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await testExportFormat('attendance', 'pdf', 'application/pdf');

    // Test Marks
    await testExportFormat('marks', 'csv', 'text/csv');
    await testExportFormat('marks', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await testExportFormat('marks', 'pdf', 'application/pdf');

    // Test Complaints
    await testExportFormat('complaints', 'csv', 'text/csv');
    await testExportFormat('complaints', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await testExportFormat('complaints', 'pdf', 'application/pdf');

    console.log('SUCCESS: All export format tests passed.');

    // ==========================================
    // TEST 4: Text Search Indexes
    // ==========================================
    console.log('\n[TEST 4] Testing Compound Text Search Index on Student model...');
    
    // We should be able to query the student using text search on name or registrationNumber
    const textSearchName = await Student.find({ $text: { $search: 'Jane' } }).lean();
    console.log(' - Text search by name "Jane" returned:', textSearchName.map(s => s.name));
    if (textSearchName.length === 0 || textSearchName[0].registrationNumber !== studentReg) {
      throw new Error('Text search by name failed to locate test student.');
    }

    const textSearchReg = await Student.find({ $text: { $search: 'SEC-999' } }).lean();
    console.log(' - Text search by registration number "SEC-999" returned:', textSearchReg.map(s => s.registrationNumber));
    if (textSearchReg.length === 0 || textSearchReg[0].registrationNumber !== studentReg) {
      throw new Error('Text search by registration number failed to locate test student.');
    }

    console.log('SUCCESS: Compound text search index functioning correctly.');

    // ==========================================
    // TEST 5: Teacher WhatsApp Link Generator
    // ==========================================
    console.log('\n[TEST 5] Testing Teacher WhatsApp Linkage endpoint...');
    
    const waRes = await fetch(`http://localhost:${PORT}/api/student/whatsapp/${teacherProfileId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const waData = await waRes.json();
    console.log(' - GET /api/student/whatsapp/:teacherId status:', waRes.status);
    console.log(' - Response data:', JSON.stringify(waData));

    if (waRes.status !== 200) {
      throw new Error(`WhatsApp endpoint returned status ${waRes.status}`);
    }

    const expectedPhone = '923991112223'; // 03991112223 -> 923991112223
    const expectedUrlPart = `https://wa.me/${expectedPhone}?text=`;
    if (!waData.data.whatsappUrl.startsWith(expectedUrlPart)) {
      throw new Error(`WhatsApp URL formatting incorrect: expected it to start with "${expectedUrlPart}", got "${waData.data.whatsappUrl}"`);
    }

    console.log('SUCCESS: WhatsApp Link Generator verified successfully.');

  } catch (error) {
    console.error('\n!!! TEST FAILURE !!!');
    console.error(error);
    process.exit(1);
  } finally {
    // 7. Cleanup & Shutdown
    console.log('\nCleaning up test databases...');
    await User.deleteMany({ mobileNumber: { $in: [adminMobile, studentMobile, teacherMobile] } });
    await Student.deleteMany({ registrationNumber: studentReg });
    await Teacher.deleteMany({ teacherId: teacherIdVal });
    await Subject.deleteMany({ subjectCode: subjectCodeVal });
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
    await Complaint.deleteMany({});
    await RegistrationNumber.deleteMany({ number: studentReg });

    await mongoose.disconnect();
    server.close(() => {
      console.log('Server shut down. Tests complete.');
      process.exit(0);
    });
  }
};

runTests();
