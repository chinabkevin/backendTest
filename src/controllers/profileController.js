import { sql } from '../config/db.js';
import { uploadImageToCloudinary, deleteImageFromCloudinary, validateImageFile } from '../utils/cloudinary.js';

// POST /api/profile/upload-image - Upload profile image
export const uploadProfileImage = async (req, res) => {
  try {
    // Get userId from body (form data)
    const userId = req.body.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Uploading profile image for userId:', userId);

    // Handle both numeric ID and UUID (supabase_id)
    let userCheck;
    const userIdString = String(userId);
    
    if (userIdString.includes('-')) {
      // It's a UUID (supabase_id)
      console.log('Checking for UUID user:', userIdString);
      userCheck = await sql`
        SELECT id, profile_image_public_id FROM "user" 
        WHERE supabase_id = ${userIdString}
      `;
    } else {
      // It's a numeric ID
      console.log('Checking for numeric user ID:', userIdString);
      const numericId = parseInt(userIdString, 10);
      if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
        userCheck = await sql`
          SELECT id, profile_image_public_id FROM "user" 
          WHERE id = ${numericId}
        `;
      } else {
        return res.status(400).json({ error: 'Invalid userId format' });
      }
    }
    
    if (!userCheck.length) {
      console.log('User not found for userId:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userCheck[0];
    console.log('Found user with numeric ID:', user.id);

    // Validate the uploaded file
    const validation = validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Delete old profile image if exists
    if (user.profile_image_public_id) {
      await deleteImageFromCloudinary(user.profile_image_public_id);
    }

    // Upload new image to Cloudinary
    const uploadResult = await uploadImageToCloudinary(req.file);
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: uploadResult.error });
    }

    // Update user profile with new image
    const result = await sql`
      UPDATE "user" 
      SET 
        profile_image_url = ${uploadResult.url},
        profile_image_public_id = ${uploadResult.public_id},
        updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING id, profile_image_url, profile_image_public_id
    `;

    // Also update barrister_profiles if it exists
    await sql`
      UPDATE barrister_profiles
      SET 
        profile_photo_url = ${uploadResult.url},
        updated_at = NOW()
      WHERE user_id = ${user.id}
    `;

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profile_image_url: uploadResult.url,
      profileImage: {
        url: uploadResult.url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.size
      }
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
};

// DELETE /api/profile/remove-image - Remove profile image
export const removeProfileImage = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Handle both numeric ID and UUID (supabase_id)
    let userCheck;
    const userIdString = String(userId);
    
    if (userIdString.includes('-')) {
      // It's a UUID (supabase_id)
      userCheck = await sql`
        SELECT id, profile_image_public_id FROM "user" 
        WHERE supabase_id = ${userIdString}
      `;
    } else {
      // It's a numeric ID
      const numericId = parseInt(userIdString, 10);
      if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
        userCheck = await sql`
          SELECT id, profile_image_public_id FROM "user" 
          WHERE id = ${numericId}
        `;
      } else {
        return res.status(400).json({ error: 'Invalid userId format' });
      }
    }
    
    if (!userCheck.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userCheck[0];

    // Delete image from Cloudinary if exists
    if (user.profile_image_public_id) {
      await deleteImageFromCloudinary(user.profile_image_public_id);
    }

    // Remove image references from user profile
    const result = await sql`
      UPDATE "user" 
      SET 
        profile_image_url = NULL,
        profile_image_public_id = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING id
    `;

    // Also update barrister_profiles if it exists
    await sql`
      UPDATE barrister_profiles
      SET 
        profile_photo_url = NULL,
        updated_at = NOW()
      WHERE user_id = ${user.id}
    `;

    res.json({
      success: true,
      message: 'Profile image removed successfully'
    });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ error: 'Failed to remove profile image' });
  }
};

// GET /api/profile/image/:userId - Get user profile image
export const getUserProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Handle both numeric ID and UUID (supabase_id)
    let userCheck;
    const userIdString = String(userId);
    
    if (userIdString.includes('-')) {
      // It's a UUID (supabase_id)
      userCheck = await sql`
        SELECT profile_image_url, profile_image_public_id 
        FROM "user" 
        WHERE supabase_id = ${userIdString}
      `;
    } else {
      // It's a numeric ID
      const numericId = parseInt(userIdString, 10);
      if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
        userCheck = await sql`
          SELECT profile_image_url, profile_image_public_id 
          FROM "user" 
          WHERE id = ${numericId}
        `;
      } else {
        return res.status(400).json({ error: 'Invalid userId format' });
      }
    }
    
    if (!userCheck.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userCheck[0];

    res.json({
      success: true,
      profileImage: {
        url: user.profile_image_url,
        publicId: user.profile_image_public_id
      }
    });
  } catch (error) {
    console.error('Error getting profile image:', error);
    res.status(500).json({ error: 'Failed to get profile image' });
  }
}; 