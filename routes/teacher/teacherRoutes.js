import express from 'express';
import multer from 'multer';
import { protect, authorizeRoles } from '../../middlewares/authMiddleware.js';

// Controller imports
import {
  getAssignedSubjects,
  getStudents,
  uploadAttendance,
  updateAttendance,
  getAttendanceForSubject
} from '../../controllers/teacher/attendanceController.js';

import {
  addMarks,
  updateMarks,
  uploadExcelMarks,
  downloadTemplate,
  getMarksForSubject
} from '../../controllers/teacher/marksController.js';

import {
  createAssignment,
  getAssignments,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  gradeSubmission
} from '../../controllers/teacher/assignmentController.js';

import {
  getComplaints,
  replyComplaint
} from '../../controllers/teacher/complaintController.js';

import {
  getTeacherDashboardStats
} from '../../controllers/teacher/dashboardController.js';

// Validator imports
import {
  validateAddAttendance,
  validateUpdateAttendance,
  validateAddMarks,
  validateUpdateMarks,
  validateCreateAssignment,
  validateReplyComplaint
} from '../../validators/teacherValidator.js';

const router = express.Router();

// Setup local memory upload for PDFs and Excel sheets (avoids image-only filter constraints)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Protect all routes globally for Teachers only
router.use(protect);
router.use(authorizeRoles('teacher'));

// 1. Subject and Student Information
router.get('/subjects', getAssignedSubjects);
router.get('/students', getStudents);

// 2. Attendance Management
router.get('/attendance', getAttendanceForSubject);
router.post('/attendance', validateAddAttendance, uploadAttendance);
router.put('/attendance/:id', validateUpdateAttendance, updateAttendance);

// 3. Marks Management
router.get('/marks', getMarksForSubject);
router.post('/marks', validateAddMarks, addMarks);
router.put('/marks/:id', validateUpdateMarks, updateMarks);
router.post('/marks/upload-excel', memoryUpload.single('file'), uploadExcelMarks);
router.get('/marks/template', downloadTemplate);

// 4. Assignment Management
router.post('/assignments', memoryUpload.single('pdfFile'), validateCreateAssignment, createAssignment);
router.get('/assignments', getAssignments);
router.put('/assignments/:id', memoryUpload.single('pdfFile'), updateAssignment);
router.delete('/assignments/:id', deleteAssignment);
router.get('/assignments/:id/submissions', getAssignmentSubmissions);
router.put('/submissions/:id/grade', gradeSubmission);

// 5. Complaint Management
router.get('/complaints', getComplaints);
router.post('/complaints/:id/reply', validateReplyComplaint, replyComplaint);

// 6. Dashboard Metrics
router.get('/dashboard', getTeacherDashboardStats);

export default router;
