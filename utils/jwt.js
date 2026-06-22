import jwt from 'jsonwebtoken';

/**
 * Generate Access Token (short-lived: 15 minutes)
 * IMPORTANT: tokenVersion is included so that protect middleware can
 * invalidate existing tokens when a user is blocked or deleted.
 * @param {Object} user - User object containing _id, role, tokenVersion
 * @returns {String} JWT Access Token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

/**
 * Generate Refresh Token (long-lived: 7 days)
 * @param {Object} user - User object containing _id
 * @returns {String} JWT Refresh Token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

/**
 * Verify Access Token
 * @param {String} token - JWT Access Token
 * @returns {Object} Decoded payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verify Refresh Token
 * @param {String} token - JWT Refresh Token
 * @returns {Object} Decoded payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
