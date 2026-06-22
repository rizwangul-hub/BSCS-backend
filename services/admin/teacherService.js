import User from '../../models/User.js';
import Teacher from '../../models/Teacher.js';
import ApiError from '../../utils/apiError.js';

/**
 * Service to register teacher and link to User account
 */
export const createTeacher = async (teacherData) => {
  const {
    name,
    email,
    mobileNumber,
    password,
    teacherId,
    qualification,
    designation,
    address,
  } = teacherData;

  // 1. Check duplicate mobile or email
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

  // 2. Check duplicate teacherId
  const existingTeacherById = await Teacher.findOne({ teacherId });
  if (existingTeacherById) {
    throw new ApiError(400, 'A teacher with this Teacher ID already exists.');
  }

  // 3. Create user account
  let user;
  try {
    user = await User.create({
      name,
      email: email || undefined,
      mobileNumber,
      password,
      role: 'teacher',
      address,
    });
  } catch (err) {
    throw new ApiError(500, `Failed to create User account: ${err.message}`);
  }

  // 4. Create teacher profile
  try {
    const teacher = await Teacher.create({
      userId: user._id,
      teacherId,
      qualification,
      designation,
      mobile: mobileNumber,
      address,
    });

    return { user, teacher };
  } catch (err) {
    // Rollback User creation if Teacher profile creation fails
    if (user) {
      await User.deleteOne({ _id: user._id });
    }
    throw new ApiError(500, `Failed to create Teacher profile. Rollback triggered: ${err.message}`);
  }
};
