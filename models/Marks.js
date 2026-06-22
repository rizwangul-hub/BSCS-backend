import mongoose from 'mongoose';

const marksSchema = new mongoose.Schema(
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
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
    },
    midMarks: {
      type: Number,
      default: 0,
      min: [0, 'Mid term marks cannot be negative'],
      max: [30, 'Mid term marks cannot exceed 30'],
    },
    presentation: {
      type: Number,
      default: 0,
      min: [0, 'Presentation marks cannot be negative'],
      max: [5, 'Presentation marks cannot exceed 5'],
    },
    test1: {
      type: Number,
      default: 0,
      min: [0, 'Test 1 marks cannot be negative'],
      max: [5, 'Test 1 marks cannot exceed 5'],
    },
    test2: {
      type: Number,
      default: 0,
      min: [0, 'Test 2 marks cannot be negative'],
      max: [5, 'Test 2 marks cannot exceed 5'],
    },
    assignment: {
      type: Number,
      default: 0,
      min: [0, 'Assignment marks cannot be negative'],
      max: [5, 'Assignment marks cannot exceed 5'],
    },
    quiz: {
      type: Number,
      default: 0,
      min: [0, 'Quiz marks cannot be negative'],
      max: [5, 'Quiz marks cannot exceed 5'],
    },
    attendanceMarks: {
      type: Number,
      default: 0,
      min: [0, 'Attendance marks cannot be negative'],
      max: [5, 'Attendance marks cannot exceed 5'],
    },
    sessionalTotal: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    grade: {
      type: String,
      default: 'F',
      enum: ['A', 'B', 'C', 'D', 'F'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on student and subject (unique: a student has one marks entry per subject)
marksSchema.index({ student: 1, subject: 1 }, { unique: true });

// Pre-save middleware to calculate sessional total, grand total, percentage, and grade
marksSchema.pre('save', function () {
  // 1. Calculate Sessional Total (Max 30)
  this.sessionalTotal =
    (this.presentation || 0) +
    (this.test1 || 0) +
    (this.test2 || 0) +
    (this.assignment || 0) +
    (this.quiz || 0) +
    (this.attendanceMarks || 0);

  // 2. Calculate Grand Total (Max 60)
  this.grandTotal = (this.midMarks || 0) + this.sessionalTotal;

  // 3. Calculate Percentage (Grand Total / 60 * 100)
  this.percentage = Math.round((this.grandTotal / 60) * 10000) / 100; // Keep two decimal places

  // 4. Assign Grade
  if (this.percentage >= 90) {
    this.grade = 'A';
  } else if (this.percentage >= 80) {
    this.grade = 'B';
  } else if (this.percentage >= 70) {
    this.grade = 'C';
  } else if (this.percentage >= 60) {
    this.grade = 'D';
  } else {
    this.grade = 'F';
  }
});

const Marks = mongoose.model('Marks', marksSchema);

export default Marks;
