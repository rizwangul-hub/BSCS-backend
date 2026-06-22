import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    sessionName: {
      type: String,
      required: [true, 'Session name is required'], // e.g. "BSCS 2024-2028"
      unique: true,
      trim: true,
    },
    startYear: {
      type: Number,
      required: [true, 'Start year is required'],
    },
    endYear: {
      type: Number,
      required: [true, 'End year is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Session = mongoose.model('Session', sessionSchema);

export default Session;
