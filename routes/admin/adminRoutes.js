import express from 'express';
import multer from 'multer';
import { protect, authorizeRoles } from '../../middlewares/authMiddleware.js';
import upload from '../../config/multer.js';

// Setup local memory upload for documents (CSV, Excel, Word, Text)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Controller imports
import {
  addStudent,
  editStudent,
  deleteStudent,
  blockStudent,
  unblockStudent,
  searchStudents,
  getAllStudents,
  getStudentById,
} from '../../controllers/admin/studentController.js';

import {
  addTeacher,
  editTeacher,
  deleteTeacher,
  blockTeacher,
  unblockTeacher,
  getTeachers,
} from '../../controllers/admin/teacherController.js';

import {
  createSubject,
  assignTeacherToSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
} from '../../controllers/admin/subjectController.js';

import {
  createSession,
  promoteSemester,
  getSessions,
  updateSession,
  deleteSession,
} from '../../controllers/admin/sessionController.js';

import {
  createTimetable,
  getTimetables,
  updateTimetable,
  deleteTimetable,
} from '../../controllers/admin/timetableController.js';

import {
  uploadRegistrationNumbers,
  createPreRegistration,
  getPreRegistrations,
  updatePreRegistration,
  deletePreRegistration,
} from '../../controllers/admin/regNoController.js';

import {
  createNotice,
  deleteNotice,
  getNotices,
  updateNotice,
} from '../../controllers/admin/noticeController.js';

import { getDashboardStats } from '../../controllers/admin/dashboardController.js';
import {
  getComplaints as getAdminComplaints,
  replyComplaint as replyAdminComplaint,
} from '../../controllers/admin/complaintController.js';

import {
  exportStudents,
  exportAttendance,
  exportMarks,
  exportComplaints,
} from '../../controllers/admin/exportController.js';

// Validator imports
import {
  validateAddStudent,
  validateEditStudent,
  validateAddTeacher,
  validateEditTeacher,
  validateCreateSubject,
  validateCreateSession,
  validateCreateTimetable,
  validateCreateNotice,
  validateCreatePreRegistration,
  validateUpdatePreRegistration,
} from '../../validators/adminValidator.js';

const router = express.Router();

// Globally protect all routes in this router - Admin only access
router.use(protect);
router.use(authorizeRoles('admin'));

// 1. Student Management
// NOTE: /search and specific named routes must precede /:id to avoid collision
router.get('/students',             getAllStudents);
router.get('/students/search',      searchStudents);
router.get('/students/:id',         getStudentById);
router.post('/students',            validateAddStudent, addStudent);
router.put('/students/:id',         validateEditStudent, editStudent);
router.delete('/students/:id',      deleteStudent);
router.patch('/students/:id/block',   blockStudent);
router.patch('/students/:id/unblock', unblockStudent);

// 2. Teacher Management
router.post('/teachers', validateAddTeacher, addTeacher);
router.put('/teachers/:id', validateEditTeacher, editTeacher);
router.delete('/teachers/:id', deleteTeacher);
router.patch('/teachers/:id/block', blockTeacher);
router.patch('/teachers/:id/unblock', unblockTeacher);
router.get('/teachers', getTeachers);

// 3. Subject Management
router.post('/subjects', validateCreateSubject, createSubject);
router.patch('/subjects/:id/assign-teacher', assignTeacherToSubject);
router.get('/subjects', getSubjects);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

// 4. Session & Promotion
router.post('/sessions', validateCreateSession, createSession);
router.post('/promote-semester', promoteSemester);
router.get('/sessions', getSessions);
router.put('/sessions/:id', updateSession);
router.delete('/sessions/:id', deleteSession);

// 5. Timetable Management
router.post('/timetable', validateCreateTimetable, createTimetable);
router.get('/timetable', getTimetables);
router.put('/timetable/:id', updateTimetable);
router.delete('/timetable/:id', deleteTimetable);

// 6. Pre-Registration Management
router.get('/pre-registrations', getPreRegistrations);
router.post('/pre-registrations', validateCreatePreRegistration, createPreRegistration);
router.put('/pre-registrations/:id', validateUpdatePreRegistration, updatePreRegistration);
router.delete('/pre-registrations/:id', deletePreRegistration);
router.post('/pre-registrations/bulk', documentUpload.single('file'), uploadRegistrationNumbers);
router.post('/registration-numbers', documentUpload.single('file'), uploadRegistrationNumbers);

// 7. Notice Board
router.post('/notices', validateCreateNotice, createNotice);
router.delete('/notices/:id', deleteNotice);
router.get('/notices', getNotices);
router.put('/notices/:id', updateNotice);

// 8. Dashboard Analytics
router.get('/dashboard', getDashboardStats);

// 8.5 Student Complaints Management
router.get('/complaints', getAdminComplaints);
router.post('/complaints/:id/reply', replyAdminComplaint);

// 9. Data Exporters
router.get('/export/students', exportStudents);
router.get('/export/attendance', exportAttendance);
router.get('/export/marks', exportMarks);
router.get('/export/complaints', exportComplaints);

export default router;

