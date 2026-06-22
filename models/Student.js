import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    fatherName: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be at least 1'],
      max: [8, 'Semester cannot exceed 8'],
      index: true,
    },
    academicSession: {
      type: String,
      required: [true, 'Academic session is required'], // e.g. "2022-2026"
      trim: true,
    },
    department: {
      type: String,
      default: 'Computer Science',
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    guardianPhone: {
      type: String,
      trim: true,
      default: '',
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    overallAttendancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStatus: {
      type: String,
      enum: {
        values: ['active', 'graduated', 'suspended'],
        message: 'Status must be active, graduated, or suspended',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Define compound text search index for fast lookup
studentSchema.index({
  name: 'text',
  registrationNumber: 'text',
  rollNumber: 'text',
});

const Student = mongoose.model('Student', studentSchema);

export default Student;
