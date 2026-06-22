import asyncHandler from 'express-async-handler';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import Student from '../../models/Student.js';
import Attendance from '../../models/Attendance.js';
import Marks from '../../models/Marks.js';
import Complaint from '../../models/Complaint.js';

// Helper to escape CSV values (handles commas/quotes)
const escapeCSV = (val) => {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Unified Export Formatter supporting PDF (PDFKit), Excel (XLSX), and CSV
const handleFormatExport = (res, format, headers, rows, title, filename) => {
  const normalizedFormat = (format || 'csv').toLowerCase();

  if (normalizedFormat === 'pdf') {
    // 1. PDF Rendering using PDFKit
    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
    doc.pipe(res);

    // Title Section
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown(1.5);

    // Draw Table Headers
    let y = doc.y;
    let startX = 30;
    const colWidth = 550 / headers.length;

    doc.fontSize(8).fillColor('#1E293B');
    headers.forEach((h, i) => {
      doc.text(h.label, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
    });

    doc.moveTo(startX, y + 12).lineTo(580, y + 12).strokeColor('#E2E8F0').stroke();
    doc.moveDown(1.2);

    // Draw Table Rows
    doc.fillColor('#475569');
    rows.forEach((row) => {
      if (doc.y > 700) {
        doc.addPage();
        y = doc.y;
        doc.fontSize(8).fillColor('#1E293B');
        headers.forEach((h, i) => {
          doc.text(h.label, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
        });
        doc.moveTo(startX, y + 12).lineTo(580, y + 12).strokeColor('#E2E8F0').stroke();
        doc.moveDown(1.2);
        doc.fillColor('#475569');
      }

      y = doc.y;
      headers.forEach((h, i) => {
        const val = row[h.key] !== undefined ? String(row[h.key]) : '';
        doc.text(val, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
      });
      doc.moveDown(1.2);
    });

    doc.end();
  } else if (normalizedFormat === 'xlsx' || normalizedFormat === 'excel') {
    // 2. Excel compilation using XLSX
    const wsData = rows.map((r) => {
      const obj = {};
      headers.forEach((h) => {
        obj[h.label] = r[h.key];
      });
      return obj;
    });

    const worksheet = xlsx.utils.json_to_sheet(wsData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, title.slice(0, 30));
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
    res.status(200).send(buffer);
  } else {
    // 3. Default CSV generation
    let csvContent = headers.map((h) => h.label).join(',') + '\n';
    rows.forEach((row) => {
      csvContent += headers.map((h) => escapeCSV(row[h.key])).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    res.status(200).send(csvContent);
  }
};

/**
 * @desc    Export Students list
 * @route   GET /api/admin/export/students
 * @access  Private/Admin
 */
export const exportStudents = asyncHandler(async (req, res, next) => {
  const students = await Student.find().populate('userId', 'email').lean();

  const headers = [
    { label: 'Name', key: 'name' },
    { label: 'Registration Number', key: 'registrationNumber' },
    { label: 'Roll Number', key: 'rollNumber' },
    { label: 'Semester', key: 'semester' },
    { label: 'Session', key: 'academicSession' },
    { label: 'Department', key: 'department' },
    { label: 'Mobile', key: 'mobile' },
    { label: 'Status', key: 'currentStatus' },
    { label: 'Email', key: 'email' },
  ];

  const rows = students.map((s) => ({
    name: s.name,
    registrationNumber: s.registrationNumber,
    rollNumber: s.rollNumber,
    semester: s.semester,
    academicSession: s.academicSession,
    department: s.department,
    mobile: s.mobile || '',
    currentStatus: s.currentStatus,
    email: s.userId?.email || '',
  }));

  handleFormatExport(res, req.query.format, headers, rows, 'Students Roster Export', 'students_export');
});

/**
 * @desc    Export Attendance history
 * @route   GET /api/admin/export/attendance
 * @access  Private/Admin
 */
export const exportAttendance = asyncHandler(async (req, res, next) => {
  const attendance = await Attendance.find()
    .populate('student', 'name registrationNumber')
    .populate('subject', 'subjectName subjectCode')
    .lean();

  const headers = [
    { label: 'Student Name', key: 'studentName' },
    { label: 'Registration Number', key: 'registrationNumber' },
    { label: 'Subject Name', key: 'subjectName' },
    { label: 'Subject Code', key: 'subjectCode' },
    { label: 'Month', key: 'month' },
    { label: 'Year', key: 'year' },
    { label: 'Total Classes', key: 'totalClasses' },
    { label: 'Attended Classes', key: 'attendedClasses' },
    { label: 'Percentage', key: 'percentage' },
  ];

  const rows = attendance.map((a) => ({
    studentName: a.student?.name || 'Unknown',
    registrationNumber: a.student?.registrationNumber || 'N/A',
    subjectName: a.subject?.subjectName || 'Unknown',
    subjectCode: a.subject?.subjectCode || 'N/A',
    month: a.month,
    year: a.year,
    totalClasses: a.totalClasses,
    attendedClasses: a.attendedClasses,
    percentage: `${a.attendancePercentage}%`,
  }));

  handleFormatExport(res, req.query.format, headers, rows, 'Attendance History Export', 'attendance_export');
});

/**
 * @desc    Export Marks records
 * @route   GET /api/admin/export/marks
 * @access  Private/Admin
 */
export const exportMarks = asyncHandler(async (req, res, next) => {
  const marks = await Marks.find()
    .populate('student', 'name registrationNumber')
    .populate('subject', 'subjectName subjectCode')
    .lean();

  const headers = [
    { label: 'Student Name', key: 'studentName' },
    { label: 'Registration Number', key: 'registrationNumber' },
    { label: 'Subject Name', key: 'subjectName' },
    { label: 'Subject Code', key: 'subjectCode' },
    { label: 'Semester', key: 'semester' },
    { label: 'Mid Marks', key: 'midMarks' },
    { label: 'Sessional Total', key: 'sessionalTotal' },
    { label: 'Grand Total', key: 'grandTotal' },
    { label: 'Percentage', key: 'percentage' },
    { label: 'Grade', key: 'grade' },
  ];

  const rows = marks.map((m) => ({
    studentName: m.student?.name || 'Unknown',
    registrationNumber: m.student?.registrationNumber || 'N/A',
    subjectName: m.subject?.subjectName || 'Unknown',
    subjectCode: m.subject?.subjectCode || 'N/A',
    semester: m.semester,
    midMarks: m.midMarks,
    sessionalTotal: m.sessionalTotal,
    grandTotal: m.grandTotal,
    percentage: `${m.percentage}%`,
    grade: m.grade,
  }));

  handleFormatExport(res, req.query.format, headers, rows, 'Academic Marks Export', 'marks_export');
});

/**
 * @desc    Export Complaints log
 * @route   GET /api/admin/export/complaints
 * @access  Private/Admin
 */
export const exportComplaints = asyncHandler(async (req, res, next) => {
  const complaints = await Complaint.find().populate('student', 'name registrationNumber').lean();

  const headers = [
    { label: 'Student Name', key: 'studentName' },
    { label: 'Registration Number', key: 'registrationNumber' },
    { label: 'Message', key: 'message' },
    { label: 'Status', key: 'status' },
    { label: 'Reply', key: 'reply' },
    { label: 'Replied Date', key: 'repliedAt' },
  ];

  const rows = complaints.map((c) => ({
    studentName: c.student?.name || 'Unknown',
    registrationNumber: c.student?.registrationNumber || 'N/A',
    message: c.message,
    status: c.status,
    reply: c.reply || '',
    repliedAt: c.repliedAt ? new Date(c.repliedAt).toLocaleDateString() : 'N/A',
  }));

  handleFormatExport(res, req.query.format, headers, rows, 'Grievance Complaints Export', 'complaints_export');
});

