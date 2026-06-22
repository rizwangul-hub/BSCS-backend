import mongoose from 'mongoose';

const registrationNumberSchema = new mongoose.Schema(
  {
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
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
    },
    session: {
      type: String,
      required: [true, 'Session is required'],
      trim: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'registrationNumbers',
  }
);

const RegistrationNumber = mongoose.model('RegistrationNumber', registrationNumberSchema);

export default RegistrationNumber;

