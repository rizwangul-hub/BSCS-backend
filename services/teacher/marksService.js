import xlsx from 'xlsx';
import Student from '../../models/Student.js';
import Marks from '../../models/Marks.js';
import Notification from '../../models/Notification.js';

/**
 * Parses Excel marks sheet and updates/inserts student marks
 * @param {Buffer} buffer - Excel file buffer
 * @param {String} subjectId - Mongoose Subject ObjectId
 * @param {Number} semester - Semester number
 * @param {String} teacherId - Mongoose Teacher ObjectId
 * @param {Object} subjectDoc - The Subject document
 * @returns {Object} Report detailing successes and failures
 */
export const parseAndSaveExcelMarks = async (buffer, subjectId, semester, teacherId, subjectDoc) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet);

  const successful = [];
  const failed = [];

  for (const row of rows) {
    const regNum = row.registrationNumber || row.RegistrationNumber || '';
    
    // Normalize properties since Excel headers can be case-sensitive
    const midMarks = Number(row.midMarks !== undefined ? row.midMarks : (row.MidMarks || 0));
    const presentation = Number(row.presentation !== undefined ? row.presentation : (row.Presentation || 0));
    const test1 = Number(row.test1 !== undefined ? row.test1 : (row.Test1 || 0));
    const test2 = Number(row.test2 !== undefined ? row.test2 : (row.Test2 || 0));
    const assignment = Number(row.assignment !== undefined ? row.assignment : (row.Assignment || 0));
    const quiz = Number(row.quiz !== undefined ? row.quiz : (row.Quiz || 0));
    const attendanceMarks = Number(row.attendanceMarks !== undefined ? row.attendanceMarks : (row.AttendanceMarks || 0));

    if (!regNum) {
      failed.push({
        row,
        reason: 'Missing registrationNumber column'
      });
      continue;
    }

    // 1. Fetch Student
    const student = await Student.findOne({ registrationNumber: regNum }).lean();
    if (!student) {
      failed.push({
        registrationNumber: regNum,
        reason: `Student not found in database`
      });
      continue;
    }

    // 2. Validate Student Semester & Session Match Subject
    if (student.semester !== semester) {
      failed.push({
        registrationNumber: regNum,
        reason: `Student semester (${student.semester}) does not match subject semester (${semester})`
      });
      continue;
    }

    if (student.academicSession !== subjectDoc.academicSession) {
      failed.push({
        registrationNumber: regNum,
        reason: `Student session (${student.academicSession}) does not match subject session (${subjectDoc.academicSession})`
      });
      continue;
    }

    if (student.currentStatus !== 'active') {
      failed.push({
        registrationNumber: regNum,
        reason: `Student status is ${student.currentStatus}`
      });
      continue;
    }

    // 3. Validate Mark Ranges
    if (midMarks < 0 || midMarks > 30) {
      failed.push({
        registrationNumber: regNum,
        reason: `midMarks (${midMarks}) must be between 0 and 30`
      });
      continue;
    }

    const sessionalRanges = { presentation, test1, test2, assignment, quiz, attendanceMarks };
    let rangeError = false;
    for (const [key, val] of Object.entries(sessionalRanges)) {
      if (val < 0 || val > 5) {
        failed.push({
          registrationNumber: regNum,
          reason: `${key} marks (${val}) must be between 0 and 5`
        });
        rangeError = true;
        break;
      }
    }
    if (rangeError) continue;

    // 4. Prevent duplicate uploads (check if marks exist)
    const existingMarks = await Marks.findOne({ student: student._id, subject: subjectId }).lean();
    if (existingMarks) {
      failed.push({
        registrationNumber: regNum,
        reason: 'Marks record already exists for this student and subject'
      });
      continue;
    }

    // 5. Create Marks Record
    try {
      const marks = await Marks.create({
        student: student._id,
        subject: subjectId,
        teacher: teacherId,
        semester,
        midMarks,
        presentation,
        test1,
        test2,
        assignment,
        quiz,
        attendanceMarks
      });

      // 6. Notify Student
      await Notification.create({
        receiver: student.userId,
        title: 'Marks Uploaded',
        message: `Your sessional and mid marks for subject ${subjectDoc.subjectName} have been uploaded.`,
        type: 'marks'
      });

      successful.push({
        registrationNumber: regNum,
        studentName: student.name,
        grandTotal: marks.grandTotal,
        grade: marks.grade
      });
    } catch (err) {
      failed.push({
        registrationNumber: regNum,
        reason: `Internal Database Error: ${err.message}`
      });
    }
  }

  return { successful, failed };
};
