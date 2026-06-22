import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import { 
  createContactMessage, 
  getContactMessages, 
  deleteContactMessage 
} from '../controllers/contactController.js';

const router = express.Router();

// Public route to submit contact message
router.post('/', createContactMessage);

// Admin protected routes
router.get('/admin/messages', protect, authorizeRoles('admin'), getContactMessages);
router.delete('/admin/messages/:id', protect, authorizeRoles('admin'), deleteContactMessage);

export default router;
