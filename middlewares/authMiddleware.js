import asyncHandler from 'express-async-handler';
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import ApiError from '../utils/apiError.js';

/**
 * Middleware to protect routes - Authenticates JWT token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for token in Authorization Header (Bearer) or Cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // If token is missing, raise unauthorized error
  if (!token) {
    return next(new ApiError(401, 'Not authenticated. Please log in.'));
  }

  try {
    // 2. Verify Access Token
    const decoded = verifyAccessToken(token);

    // 3. Find user in the database
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(401, 'The user belonging to this token no longer exists.'));
    }

    // Check if token version matches the user's current token version
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      return next(new ApiError(401, 'Your session has been terminated. Please log in again.'));
    }

    // 4. Check if account is active and not blocked
    if (!user.isActive) {
      return next(new ApiError(403, 'Your account is inactive. Please contact administration.'));
    }

    if (user.isBlocked) {
      return next(new ApiError(403, 'Your account has been blocked. Access denied.'));
    }

    // 5. Check if password was changed after the token was issued
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return next(
          new ApiError(401, 'User recently changed password. Please log in again.')
        );
      }
    }

    // 6. Grant access by storing user in request context
    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authenticated. Token is invalid or expired.'));
  }
});

/**
 * Middleware to authorize specific roles
 * @param {...String} roles - List of allowed roles (Admin, Teacher, Student)
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Role (${req.user.role}) is not authorized to access this resource`
        )
      );
    }
    next();
  };
};
