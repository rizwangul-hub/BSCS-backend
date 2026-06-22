import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload memory buffer file to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from Multer memory storage
 * @param {String} folder - Target folder in Cloudinary
 * @returns {Promise<String>} Secure URL of uploaded image
 */
export const uploadBufferToCloudinary = (fileBuffer, folder = 'gpgc_profiles') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        quality: 'auto',
        fetch_format: 'auto'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export default cloudinary;
