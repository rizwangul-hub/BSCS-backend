import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import upload from '../config/multer.js';
import {
  getStudentDashboardStats,
  getStudentMarks,
  getStudentAttendance,
  getStudentTimetable,
  getStudentAssignments,
  submitAssignment,
  getStudentComplaints,
  submitComplaint,
  getStudentNotices,
  getStudentNotifications,
  getStudentProfile,
  updateStudentProfile,
  getTeacherWhatsAppLink,
} from '../controllers/studentPortalController.js';

const router = express.Router();

// Globally protect all student routes
router.use(protect);
router.use(authorizeRoles('student'));

// Dashboard
router.get('/dashboard', getStudentDashboardStats);

// Academic
router.get('/marks',      getStudentMarks);
router.get('/attendance', getStudentAttendance);
router.get('/timetable',  getStudentTimetable);

// Assignments
router.get('/assignments',               getStudentAssignments);
router.post('/assignments/:id/submit',   upload.single('file'), submitAssignment);

// Complaints
router.get('/complaints',  getStudentComplaints);
router.post('/complaints', submitComplaint);

// Notices
router.get('/notices',       getStudentNotices);

// Notifications
router.get('/notifications', getStudentNotifications);

// Profile
router.get('/profile', getStudentProfile);
router.put('/profile', updateStudentProfile);

// Utility
router.get('/whatsapp/:teacherId', getTeacherWhatsAppLink);

export default router;
