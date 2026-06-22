import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import errorHandler from './middlewares/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import teacherRoutes from './routes/teacher/teacherRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import ApiError from './utils/apiError.js';
import connectDB from './config/db.js';

const app = express();

// Initialize Database Connection
connectDB();

// 1. Global Security Middlewares
app.use(helmet()); // Set security HTTP headers

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://bscs-gpgc-lakki.vercel.app'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. mobile apps, postman, curl)
      if (!origin) return callback(null, true);
      
      const isAllowed = 
        allowedOrigins.includes(origin) || 
        origin.startsWith('http://localhost:') || 
        origin.endsWith('.vercel.app') ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 2. Request Logging Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 3. Body parsers (with payload size limits to mitigate DOS attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 4. Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000, // Limit each IP to 5000 in dev, 1000 in prod per window
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 5. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/contact', contactRoutes);

// Root route helper
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to GPGC Computer Science Department API!',
  });
});

// 6. Handle Undefined Routes (404)
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot find ${req.originalUrl} on this server`));
});

// 7. Global Error Handler
app.use(errorHandler);

export default app;
