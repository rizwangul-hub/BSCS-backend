import mongoose from 'mongoose';
import ApiError from '../utils/apiError.js';

/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // If the error is not an instance of ApiError, convert it
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || (error instanceof mongoose.Error ? 400 : 500);
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, err.errors || [], err.stack);
  }

  // Handle Mongoose Duplicate Key Error (e.g., duplicate email/phone)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(', ');
    const message = `Duplicate value entered for ${field}. Please use another value.`;
    error = new ApiError(400, message);
  }

  // Handle Invalid JWT Signature
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid Token. Please log in again.';
    error = new ApiError(401, message);
  }

  // Handle Expired JWT
  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired. Please log in again.';
    error = new ApiError(401, message);
  }

  const response = {
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  // Log error (for debugging in dev, or integration in production audit logs)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.error(err);
  }

  res.status(error.statusCode || 500).json(response);
};

export default errorHandler;
