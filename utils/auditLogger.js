import AuditLog from '../models/AuditLog.js';

/**
 * Helper utility to log admin actions in the database
 * @param {Object} req - Express Request object
 * @param {String} action - Text description of action performed
 * @param {String} module - Module category (e.g. "student", "teacher", "subject")
 * @param {String} targetUser - Target user ObjectId (optional)
 */
export const logAdminAction = async (req, action, module, targetUser = null) => {
  try {
    await AuditLog.create({
      action,
      module,
      performedBy: req.user._id,
      targetUser: targetUser || null,
      ipAddress: req.ip || (req.connection && req.connection.remoteAddress) || '',
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (error) {
    console.error(`Audit logging failed: ${error.message}`);
  }
};
