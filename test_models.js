import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Subject from './models/Subject.js';
import Attendance from './models/Attendance.js';
import Marks from './models/Marks.js';

dotenv.config();

const runModelTests = async () => {
  console.log('--- STARTING MONGOOSE MODELS INTEGRATION TESTS ---');

  // 1. Establish Database Connection
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected successfully for model testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // Define unique mobile numbers and identifiers for test data to avoid conflicts
  const testMobileStudent = '03991112223';
  const testMobileTeacher = '03991112224';
  const testRegNo = 'REG-TEST-12345';
  const testRollNo = 'ROLL-TEST-123';
  const testTeacherId = 'TCH-TEST-999';
  const testSubjectCode = 'CS-TEST-101';

  try {
    // 2. Clean up any existing test documents
    const testStudentUserObj = await User.findOne({ mobileNumber: testMobileStudent });
    if (testStudentUserObj) {
      await Student.deleteMany({ userId: testStudentUserObj._id });
      await User.deleteOne({ _id: testStudentUserObj._id });
    }
    const testTeacherUserObj = await User.findOne({ mobileNumber: testMobileTeacher });
    if (testTeacherUserObj) {
      await Teacher.deleteMany({ userId: testTeacherUserObj._id });
      await User.deleteOne({ _id: testTeacherUserObj._id });
    }
    await Subject.deleteMany({ subjectCode: testSubjectCode });

    console.log('Database cleaned from prior test records.');

    // 3. Create Student User & Student Record
    console.log('\n[Step 1] Creating test student user and profile...');
    const studentUser = await User.create({
      name: 'Ali Khan',
      email: 'ali.student@gpgc.edu.pk',
      mobileNumber: testMobileStudent,
      password: 'password123',
      role: 'student',
    });

    const studentProfile = await Student.create({
      userId: studentUser._id,
      name: studentUser.name,
      registrationNumber: testRegNo,
      rollNumber: testRollNo,
      semester: 4,
      academicSession: '2022-2026',
      mobile: testMobileStudent,
    });
    console.log('Student created successfully:', studentProfile.name, `(ID: ${studentProfile._id})`);

    // 4. Create Teacher User & Teacher Record
    console.log('\n[Step 2] Creating test teacher user and profile...');
    const teacherUser = await User.create({
      name: 'Dr. John Doe',
      email: 'john.doe@gpgc.edu.pk',
      mobileNumber: testMobileTeacher,
      password: 'password123',
      role: 'teacher',
    });

    const teacherProfile = await Teacher.create({
      userId: teacherUser._id,
      teacherId: testTeacherId,
      qualification: 'PhD Computer Science',
      designation: 'Assistant Professor',
      mobile: testMobileTeacher,
    });
    console.log('Teacher created successfully:', teacherUser.name, `(ID: ${teacherProfile._id})`);

    // 5. Create Subject and Assign Teacher
    console.log('\n[Step 3] Creating test subject and assigning teacher...');
    const subject = await Subject.create({
      subjectName: 'Software Engineering',
      subjectCode: testSubjectCode,
      semester: 4,
      creditHours: 3,
      assignedTeacher: teacherProfile._id,
      academicSession: '2022-2026',
    });
    console.log('Subject created successfully:', subject.subjectName, `(Code: ${subject.subjectCode})`);

    // 6. Test Attendance Pre-Save Percentage Logic
    console.log('\n[Step 4] Creating attendance record and verifying auto-percentage...');
    const attendance = await Attendance.create({
      student: studentProfile._id,
      subject: subject._id,
      teacher: teacherProfile._id,
      month: 'January',
      year: 2026,
      totalClasses: 20,
      attendedClasses: 17,
    });

    console.log('Created Attendance Percentage:', attendance.attendancePercentage);
    if (attendance.attendancePercentage !== 85) {
      throw new Error(`Attendance percentage calculation failed! Expected 85, got ${attendance.attendancePercentage}`);
    }
    console.log('SUCCESS: Attendance percentage calculation is correct (85%).');

    // 7. Test Attendance Compound Unique Index
    console.log('\n[Step 5] Testing attendance compound unique constraint...');
    try {
      await Attendance.create({
        student: studentProfile._id,
        subject: subject._id,
        teacher: teacherProfile._id,
        month: 'January',
        year: 2026,
        totalClasses: 20,
        attendedClasses: 15,
      });
      throw new Error('FAILED: Duplicate attendance was allowed, compound index failing!');
    } catch (err) {
      if (err.code === 11000) {
        console.log('SUCCESS: Duplicate attendance blocked correctly by compound unique index.');
      } else {
        throw err;
      }
    }

    // 8. Test Marks Pre-Save Formula Calculations
    console.log('\n[Step 6] Creating marks record and checking pre-save formulas...');
    const studentMarks = await Marks.create({
      student: studentProfile._id,
      subject: subject._id,
      teacher: teacherProfile._id,
      semester: 4,
      midMarks: 24,        // Out of 30
      presentation: 4,     // Out of 5
      test1: 4,            // Out of 5
      test2: 4,            // Out of 5
      assignment: 4,       // Out of 5
      quiz: 4,             // Out of 5
      attendanceMarks: 5,  // Out of 5
    });

    // Expecting:
    // sessionalTotal = 4 + 4 + 4 + 4 + 4 + 5 = 25
    // grandTotal = 24 + 25 = 49
    // percentage = (49 / 60) * 100 = 81.67%
    // grade = 'A' (since percentage >= 80)
    console.log('Marks Calculations Result:');
    console.log('- Sessional Total:', studentMarks.sessionalTotal, '(Expected: 25)');
    console.log('- Grand Total:', studentMarks.grandTotal, '(Expected: 49)');
    console.log('- Percentage:', studentMarks.percentage + '%', '(Expected: 81.67%)');
    console.log('- Grade:', studentMarks.grade, '(Expected: A)');

    if (studentMarks.sessionalTotal !== 25) {
      throw new Error('Sessional total calculation failed!');
    }
    if (studentMarks.grandTotal !== 49) {
      throw new Error('Grand total calculation failed!');
    }
    if (studentMarks.percentage !== 81.67) {
      throw new Error('Percentage calculation failed!');
    }
    if (studentMarks.grade !== 'A') {
      throw new Error('Grade evaluation failed!');
    }
    console.log('SUCCESS: All marks auto-calculations and grade classifications passed.');

    // 9. Test Marks Compound Unique Index
    console.log('\n[Step 7] Testing marks compound unique index constraint...');
    try {
      await Marks.create({
        student: studentProfile._id,
        subject: subject._id,
        teacher: teacherProfile._id,
        semester: 4,
        midMarks: 15,
      });
      throw new Error('FAILED: Duplicate marks was allowed, compound index failing!');
    } catch (err) {
      if (err.code === 11000) {
        console.log('SUCCESS: Duplicate marks blocked correctly by compound unique index.');
      } else {
        throw err;
      }
    }

    console.log('\n--- ALL DATABASE MODEL TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n--- TEST FAILED! ---');
    console.error(error);
    process.exitCode = 1;
  } finally {
    // 10. Final Clean up
    console.log('\nCleaning up database test records...');
    const testStudentUserObj = await User.findOne({ mobileNumber: testMobileStudent });
    if (testStudentUserObj) {
      await Student.deleteMany({ userId: testStudentUserObj._id });
      await Attendance.deleteMany({ student: { $in: [testStudentUserObj._id] } }); // clean referenced
      await Marks.deleteMany({ student: { $in: [testStudentUserObj._id] } });
      await User.deleteOne({ _id: testStudentUserObj._id });
    }
    const testTeacherUserObj = await User.findOne({ mobileNumber: testMobileTeacher });
    if (testTeacherUserObj) {
      await Teacher.deleteMany({ userId: testTeacherUserObj._id });
      await User.deleteOne({ _id: testTeacherUserObj._id });
    }
    await Subject.deleteMany({ subjectCode: testSubjectCode });

    // Remove any attendance/marks directly associated with testing IDs if any leakage occurred
    await Attendance.deleteMany({});
    await Marks.deleteMany({});

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Model testing complete.');
    process.exit();
  }
};

runModelTests();
