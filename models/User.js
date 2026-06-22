import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import validator from 'validator';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true, // Allows multiple users without an email (since email is optional)
      validate: [validator.isEmail, 'Please provide a valid email address'],
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      index: true, // Index for fast lookup
      validate: {
        validator: function (v) {
          return validator.isMobilePhone(v, 'any');
        },
        message: 'Please provide a valid mobile number',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Prevents accidental exposure of password hash in standard queries
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['admin', 'teacher', 'student'],
        message: 'Role must be admin, teacher, or student',
      },
      default: 'student',
      index: true, // Index for fast filtering
    },
    profileImage: {
      type: String,
      default: '', // Will store Cloudinary image URL
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLogin: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    refreshToken: {
      type: String,
      select: false, // Exclude refreshToken from default responses
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving it to the database
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Update passwordChangedAt timestamp if password is modified
userSchema.pre('save', function () {
  if (!this.isModified('password') || this.isNew) return;

  this.passwordChangedAt = Date.now() - 1000; // Offset by 1s to ensure token creation is later than password change
});

// Instance Method: Compare candidate password with the stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance Method: Generate JWT Access Token
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, role: this.role, tokenVersion: this.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

// Instance Method: Generate and hash password reset token
userSchema.methods.generateResetToken = function () {
  // Create a plain token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash it and set to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiration time (e.g., 10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return the plain unhashed token to send to the user
  return resetToken;
};

const User = mongoose.model('User', userSchema);

export default User;
