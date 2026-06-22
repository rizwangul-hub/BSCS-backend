import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Notice description is required'],
      trim: true,
    },
    targetAudience: {
      type: String,
      required: [true, 'Target audience is required'],
      enum: {
        values: ['students', 'teachers', 'all'],
        message: 'Audience must be students, teachers, or all',
      },
      default: 'all',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted by reference is required'],
    },
    expiryDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Notice = mongoose.model('Notice', noticeSchema);

export default Notice;
