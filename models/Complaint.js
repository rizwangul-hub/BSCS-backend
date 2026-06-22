import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: 'General Complaint',
    },
    category: {
      type: String,
      trim: true,
      enum: {
        values: ['Academic', 'Administrative', 'Facilities', 'Fee Related', 'Other'],
        message: 'Category must be a valid complaint category',
      },
      default: 'Academic',
    },
    message: {
      type: String,
      required: [true, 'Complaint message is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'reviewing', 'resolved', 'rejected'],
        message: 'Status must be pending, reviewing, resolved, or rejected',
      },
      default: 'pending',
    },
    reply: {
      type: String,
      trim: true,
      default: '',
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    repliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;

