import asyncHandler from 'express-async-handler';
import path from 'path';
import XLSX from 'xlsx';
import RegistrationNumber from '../../models/RegistrationNumber.js';
import Student from '../../models/Student.js';
import { logAdminAction } from '../../utils/auditLogger.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Helper to dynamically map CSV/Excel headers to schema properties
 */
const mapHeaders = (row) => {
  const mapped = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.toLowerCase().trim().replace(/[\s_-]/g, '');
    const val = row[key];

    if (
      cleanKey === 'registrationnumber' || 
      cleanKey === 'regno' || 
      cleanKey === 'registrationno' || 
      cleanKey === 'regnumber'
    ) {
      mapped.registrationNumber = String(val).trim();
    } else if (
      cleanKey === 'rollnumber' || 
      cleanKey === 'rollno' || 
      cleanKey === 'roll'
    ) {
      mapped.rollNumber = String(val).trim();
    } else if (
      cleanKey === 'name' || 
      cleanKey === 'fullname' || 
      cleanKey === 'studentname'
    ) {
      mapped.name = String(val).trim();
    } else if (
      cleanKey === 'semester' || 
      cleanKey === 'sem'
    ) {
      mapped.semester = Number(val);
    } else if (
      cleanKey === 'session' || 
      cleanKey === 'academicsession' || 
      cleanKey === 'academicsessions'
    ) {
      mapped.session = String(val).trim();
    }
  }
  return mapped;
};

/**
 * @desc    Upload pre-approved student records (Excel/CSV)
 * @route   POST /api/admin/pre-registrations/bulk
 * @access  Private/Admin
 */
export const uploadRegistrationNumbers = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'Please upload a CSV or Excel file.'));
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    return next(new ApiError(400, 'Only Excel (.xlsx, .xls) and CSV (.csv) files are supported.'));
  }

  let records = [];
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    for (const row of jsonData) {
      const mapped = mapHeaders(row);
      // Validate all required fields are present in the row
      if (
        mapped.registrationNumber && 
        mapped.rollNumber && 
        mapped.name && 
        !isNaN(mapped.semester) && 
        mapped.session
      ) {
        records.push(mapped);
      }
    }
  } catch (err) {
    return next(new ApiError(400, `Failed to parse file: ${err.message}`));
  }

  if (records.length === 0) {
    return next(
      new ApiError(
        400,
        'No valid student records found in file. Ensure headers for "Registration Number", "Roll Number", "Name", "Semester", and "Session" are present and filled correctly.'
      )
    );
  }

  // Bulk update or insert pre-registrations
  const bulkOps = records.map((rec) => ({
    updateOne: {
      filter: { registrationNumber: rec.registrationNumber },
      update: {
        $setOnInsert: { isRegistered: false },
        $set: {
          rollNumber: rec.rollNumber,
          name: rec.name,
          semester: rec.semester,
          session: rec.session,
        },
      },
      upsert: true,
    },
  }));

  const bulkResult = await RegistrationNumber.bulkWrite(bulkOps);

  await logAdminAction(
    req,
    `Admin bulk uploaded pre-registrations. Total processed: ${records.length}. Upserted: ${bulkResult.upsertedCount}`,
    'registration'
  );

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalProcessed: records.length,
        insertedCount: bulkResult.upsertedCount,
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
        successful: new Array(bulkResult.upsertedCount + (bulkResult.modifiedCount || 0)).fill({}),
        failed: [],
      },
      'Pre-registration records uploaded successfully'
    )
  );
});

/**
 * @desc    Add single student pre-registration record manually
 * @route   POST /api/admin/pre-registrations
 * @access  Private/Admin
 */
export const createPreRegistration = asyncHandler(async (req, res, next) => {
  const { registrationNumber, rollNumber, name, semester, session } = req.body;

  const existing = await RegistrationNumber.findOne({
    registrationNumber: { $regex: new RegExp(`^${registrationNumber.trim()}$`, 'i') },
  });
  if (existing) {
    return next(new ApiError(400, `Registration number ${registrationNumber} already exists.`));
  }

  const record = await RegistrationNumber.create({
    registrationNumber: registrationNumber.trim(),
    rollNumber: rollNumber.trim(),
    name: name.trim(),
    semester: Number(semester),
    session: session.trim(),
    isRegistered: false,
  });

  await logAdminAction(
    req,
    `Admin added pre-registration record for: ${name} (${registrationNumber})`,
    'registration'
  );

  res.status(201).json(new ApiResponse(201, record, 'Pre-registration record created successfully'));
});

/**
 * @desc    Get all pre-registration records (paginated list with search/filter)
 * @route   GET /api/admin/pre-registrations
 * @access  Private/Admin
 */
export const getPreRegistrations = asyncHandler(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 15;
  const skip = (page - 1) * limit;
  const { registrationNumber, name, semester, session } = req.query;

  const query = {};
  if (registrationNumber) {
    query.registrationNumber = { $regex: registrationNumber.trim(), $options: 'i' };
  }
  if (name) {
    query.name = { $regex: name.trim(), $options: 'i' };
  }
  if (semester) {
    query.semester = Number(semester);
  }
  if (session) {
    query.session = session.trim();
  }

  const [records, total] = await Promise.all([
    RegistrationNumber.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RegistrationNumber.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        records,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
      'Pre-registration records list retrieved successfully'
    )
  );
});

/**
 * @desc    Edit a pre-registration record (and propagate to Student if registered)
 * @route   PUT /api/admin/pre-registrations/:id
 * @access  Private/Admin
 */
export const updatePreRegistration = asyncHandler(async (req, res, next) => {
  const record = await RegistrationNumber.findById(req.params.id);
  if (!record) {
    return next(new ApiError(404, 'Pre-registration record not found'));
  }

  const { rollNumber, name, semester, session } = req.body;

  if (rollNumber !== undefined) record.rollNumber = rollNumber.trim();
  if (name !== undefined) record.name = name.trim();
  if (semester !== undefined) record.semester = Number(semester);
  if (session !== undefined) record.session = session.trim();

  await record.save();

  // If student has already registered, update student profile as well to keep data synchronized
  if (record.isRegistered) {
    const student = await Student.findOne({ 
      registrationNumber: { $regex: new RegExp(`^${record.registrationNumber}$`, 'i') } 
    });
    if (student) {
      if (rollNumber !== undefined) student.rollNumber = rollNumber.trim();
      if (name !== undefined) student.name = name.trim();
      if (semester !== undefined) student.semester = Number(semester);
      if (session !== undefined) student.academicSession = session.trim();
      await student.save();
    }
  }

  await logAdminAction(
    req,
    `Admin updated pre-registration record details for: ${record.registrationNumber}`,
    'registration'
  );

  res.status(200).json(new ApiResponse(200, record, 'Pre-registration record updated successfully'));
});

/**
 * @desc    Delete pre-registration record (only allowed if not registered)
 * @route   DELETE /api/admin/pre-registrations/:id
 * @access  Private/Admin
 */
export const deletePreRegistration = asyncHandler(async (req, res, next) => {
  const record = await RegistrationNumber.findById(req.params.id);
  if (!record) {
    return next(new ApiError(404, 'Pre-registration record not found'));
  }

  if (record.isRegistered) {
    return next(
      new ApiError(400, 'Cannot delete a registration number that has already been registered by a student.')
    );
  }

  await record.deleteOne();

  await logAdminAction(
    req,
    `Admin deleted pre-registration record for: ${record.registrationNumber}`,
    'registration'
  );

  res.status(200).json(new ApiResponse(200, {}, 'Pre-registration record deleted successfully'));
});
