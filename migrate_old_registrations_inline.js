import Student from './models/Student.js';
import RegistrationNumber from './models/RegistrationNumber.js';

/**
 * Automigration helper to align old student data with new pre-registrations ERP system
 */
export const runInlineMigration = async () => {
  console.log('=== RUNNING AUTOMATIC PRE-REGISTRATION DATA MIGRATION ===');
  try {
    const students = await Student.find({}).lean();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const regNoClean = student.registrationNumber ? student.registrationNumber.trim() : '';
      if (!regNoClean) {
        skippedCount++;
        continue;
      }

      // Look up pre-registration record
      const existing = await RegistrationNumber.findOne({
        registrationNumber: { $regex: new RegExp(`^${regNoClean}$`, 'i') }
      });

      if (existing) {
        // Keep in sync
        let changed = false;
        if (existing.rollNumber !== student.rollNumber) {
          existing.rollNumber = student.rollNumber;
          changed = true;
        }
        if (existing.name !== student.name) {
          existing.name = student.name;
          changed = true;
        }
        if (existing.semester !== student.semester) {
          existing.semester = student.semester;
          changed = true;
        }
        if (existing.session !== student.academicSession) {
          existing.session = student.academicSession;
          changed = true;
        }
        if (!existing.isRegistered) {
          existing.isRegistered = true;
          changed = true;
        }

        if (changed) {
          await existing.save();
        }
        skippedCount++;
      } else {
        // Create new pre-registration record matching student profile
        await RegistrationNumber.create({
          registrationNumber: regNoClean,
          rollNumber: student.rollNumber,
          name: student.name,
          semester: student.semester,
          session: student.academicSession,
          isRegistered: true,
        });
        migratedCount++;
      }
    }
    console.log(`Pre-registration migration completed: ${migratedCount} migrated, ${skippedCount} verified/synced.`);
  } catch (err) {
    console.error('Pre-registration automatic migration failed:', err.message);
  }
};
