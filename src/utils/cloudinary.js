import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Check if Cloudinary is properly configured
const isCloudinaryConfigured = () => {
  const hasConfig = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret;
  
  if (!hasConfig) {
    console.warn('⚠️  Cloudinary configuration missing:');
    console.warn(`   CLOUDINARY_CLOUD_NAME: ${cloudinaryConfig.cloud_name ? 'SET' : 'MISSING'}`);
    console.warn(`   CLOUDINARY_API_KEY: ${cloudinaryConfig.api_key ? 'SET' : 'MISSING'}`);
    console.warn(`   CLOUDINARY_API_SECRET: ${cloudinaryConfig.api_secret ? 'SET' : 'MISSING'}`);
  } else {
    console.log('✅ Cloudinary configured successfully');
    console.log(`   Cloud Name: ${cloudinaryConfig.cloud_name}`);
    console.log(`   API Key: ${cloudinaryConfig.api_key.substring(0, 8)}...`);
  }
  
  return hasConfig;
};

if (isCloudinaryConfigured()) {
  cloudinary.config(cloudinaryConfig);
} else {
  console.warn('⚠️  Cloudinary not configured. Profile image uploads will be disabled.');
  console.warn('   Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
}

// Upload image to Cloudinary
export const uploadImageToCloudinary = async (file, options = {}) => {
  try {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      return {
        success: false,
        error: 'Cloudinary is not configured. Please set up your Cloudinary credentials in the .env file.'
      };
    }

    const uploadOptions = {
      folder: 'advoqat-profiles',
      ...options
    };

    console.log('📤 Uploading to Cloudinary with options:', uploadOptions);
    
    const result = await cloudinary.uploader.upload(file.path, uploadOptions);
    
    console.log('✅ Upload successful:', {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height
    });
    
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload image';
    
    if (error.http_code === 401) {
      errorMessage = 'Invalid Cloudinary credentials. Please check your API key and secret.';
    } else if (error.http_code === 400) {
      errorMessage = 'Invalid upload parameters. Please try again.';
    } else if (error.message && error.message.includes('Invalid Signature')) {
      errorMessage = 'Cloudinary signature error. Please verify your API credentials.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Delete image from Cloudinary
export const deleteImageFromCloudinary = async (publicId) => {
  try {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      return {
        success: false,
        error: 'Cloudinary is not configured. Please set up your Cloudinary credentials in the .env file.'
      };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      message: result.result === 'ok' ? 'Image deleted successfully' : 'Failed to delete image'
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete image'
    };
  }
};

// Get Cloudinary URL with transformations
export const getCloudinaryUrl = (publicId, transformations = []) => {
  if (!publicId || !isCloudinaryConfigured()) return null;
  
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const transformString = transformations.length > 0 ? transformations.join('/') : '';
  
  return `${baseUrl}/${transformString}/${publicId}`;
};

// Validate image file
export const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 10 * 1024 * 1024; // 10MB (increased for testing)
  
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Only JPG and PNG images are allowed'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image size must be less than 10MB'
    };
  }
  
  return {
    valid: true,
    error: null
  };
}; 