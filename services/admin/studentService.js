import User from '../../models/User.js';
import Student from '../../models/Student.js';
import RegistrationNumber from '../../models/RegistrationNumber.js';
import ApiError from '../../utils/apiError.js';

/**
 * Service to register student and link to User account
 */
export const createStudent = async (studentData, isAdminCreate = false) => {
  let {
    registrationNumber,
    rollNumber,
    name,
    semester,
    academicSession,
    mobileNumber,
    password,
    email,
    address,
  } = studentData;

  registrationNumber = registrationNumber ? registrationNumber.trim() : '';

  // 1. Find pre-registration record
  let regRecord = await RegistrationNumber.findOne({
    registrationNumber: { $regex: new RegExp(`^${registrationNumber}$`, 'i') }
  });

  if (isAdminCreate) {
    // Admin direct student creation
    if (regRecord) {
      if (regRecord.isRegistered) {
        throw new ApiError(400, `Registration number ${registrationNumber} has already been registered.`);
      }
      // Set to registered and update details in case they differ
      regRecord.isRegistered = true;
      regRecord.rollNumber = rollNumber;
      regRecord.name = name;
      regRecord.semester = Number(semester);
      regRecord.session = academicSession;
      await regRecord.save();
    } else {
      // Auto-create pre-registration record marked as registered
      regRecord = await RegistrationNumber.create({
        registrationNumber,
        rollNumber,
        name,
        semester: Number(semester),
        session: academicSession,
        isRegistered: true,
      });
    }
  } else {
    // Student self-registration
    if (!regRecord) {
      throw new ApiError(400, 'Invalid Registration Number.');
    }
    if (regRecord.isRegistered) {
      throw new ApiError(400, 'This Registration Number is already registered.');
    }

    // Auto-populate all details from the verified pre-registration record
    name = regRecord.name;
    semester = regRecord.semester;
    academicSession = regRecord.session;
    rollNumber = regRecord.rollNumber;
  }

  // 2. Check for duplicate mobile number or email in User collection
  const existingUserByMobile = await User.findOne({ mobileNumber });
  if (existingUserByMobile) {
    throw new ApiError(400, 'A user with this mobile number already exists.');
  }

  if (email) {
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      throw new ApiError(400, 'A user with this email already exists.');
    }
  }

  // 3. Create user account
  let user;
  try {
    user = await User.create({
      name,
      email: email || undefined,
      mobileNumber,
      password,
      role: 'student',
      address,
    });
  } catch (err) {
    throw new ApiError(500, `Failed to create User account: ${err.message}`);
  }

  // 4. Create student profile
  try {
    const student = await Student.create({
      userId: user._id,
      name,
      registrationNumber: regRecord.registrationNumber, // Use canonical registrationNumber from database
      rollNumber,
      semester,
      academicSession,
      mobile: mobileNumber,
      address,
    });

    if (!isAdminCreate) {
      // Mark pre-registration record as registered
      regRecord.isRegistered = true;
      await regRecord.save();
    }

    return { user, student };
  } catch (err) {
    // Rollback User creation if Student profile creation fails
    if (user) {
      await User.deleteOne({ _id: user._id });
    }
    throw new ApiError(500, `Failed to create Student profile. Rollback triggered: ${err.message}`);
  }
};
