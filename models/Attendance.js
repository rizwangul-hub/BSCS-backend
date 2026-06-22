import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    month: {
      type: String,
      required: [true, 'Month is required'],
      enum: {
        values: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
        message: 'Month must be a valid month name',
      },
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2000, 'Year must be after 2000'],
    },
    totalClasses: {
      type: Number,
      required: [true, 'Total classes count is required'],
      min: [0, 'Total classes cannot be negative'],
    },
    attendedClasses: {
      type: Number,
      required: [true, 'Attended classes count is required'],
      min: [0, 'Attended classes cannot be negative'],
      validate: {
        validator: function (v) {
          return v <= this.totalClasses;
        },
        message: 'Attended classes cannot exceed total classes',
      },
    },
    attendancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lowAttendance: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Define compound unique index: student + subject + month + year
attendanceSchema.index(
  { student: 1, subject: 1, month: 1, year: 1 },
  { unique: true }
);

// Pre-save middleware to automatically calculate attendance percentage and warning status
attendanceSchema.pre('save', function () {
  if (this.totalClasses === 0) {
    this.attendancePercentage = 0;
  } else {
    this.attendancePercentage = Math.round((this.attendedClasses / this.totalClasses) * 10000) / 100; // Keep two decimal places
  }
  this.lowAttendance = this.attendancePercentage < 75;
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
