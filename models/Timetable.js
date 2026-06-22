import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
  {
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
      index: true,
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
    day: {
      type: String,
      required: [true, 'Day of week is required'],
      enum: {
        values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        message: 'Day must be Monday through Sunday',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'], // e.g. "08:30"
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'], // e.g. "10:00"
      trim: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes to speed up queries by day/room, day/teacher, day/semester
timetableSchema.index({ day: 1, roomNumber: 1 });
timetableSchema.index({ day: 1, teacher: 1 });
timetableSchema.index({ day: 1, semester: 1 });

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
