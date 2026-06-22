import multer from 'multer';
import path from 'path';
import ApiError from '../utils/apiError.js';

// Setup memory storage since we upload files directly to Cloudinary
const storage = multer.memoryStorage();

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp/;
  const allowedMimetypes = /image\/(jpeg|jpg|png|webp)/;

  const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedMimetypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only images (.jpg, .jpeg, .png, .webp) are allowed!'), false);
  }
};

// Configure Multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export default upload;
