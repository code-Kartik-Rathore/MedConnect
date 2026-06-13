const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a Base64 image string to Cloudinary.
 * @param {string} base64Str - The raw base64 string or data URI (e.g. data:image/png;base64,...)
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<string>} The secure URL of the uploaded image
 */
const uploadImage = async (base64Str, folder = 'medconnect') => {
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Str, {
      folder: folder,
      resource_type: 'auto'
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

module.exports = { uploadImage };
