import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver reference is required'],
      index: true, // Index for fast filtering for user notifications
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: ['marks', 'attendance', 'notice', 'complaint'],
        message: 'Type must be marks, attendance, notice, or complaint',
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true, // Index to fetch unread notifications quickly
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
