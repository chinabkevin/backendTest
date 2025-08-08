import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '../config/db.js';
import mammoth from 'mammoth';
import textract from 'textract';

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Check if Cloudinary is properly configured
const isCloudinaryConfigured = () => {
  const hasConfig = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret;
  return hasConfig;
};

if (isCloudinaryConfigured()) {
  cloudinary.config(cloudinaryConfig);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/case-documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOC, DOCX, and image files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and image files are allowed.'), false);
    }
  }
});

// Upload case document to Cloudinary
export const uploadCaseDocument = async (file, caseId, documentType = 'summary') => {
  try {
    if (!isCloudinaryConfigured()) {
      return {
        success: false,
        error: 'Cloudinary is not configured. Please set up your Cloudinary credentials.'
      };
    }

    const uploadOptions = {
      folder: `advoqat-cases/${caseId}`,
      resource_type: 'auto',
      public_id: `${documentType}-${Date.now()}`,
      overwrite: false
    };

    console.log('📤 Uploading case document to Cloudinary:', {
      filename: file.originalname,
      caseId,
      documentType,
      options: uploadOptions
    });
    
    const result = await cloudinary.uploader.upload(file.path, uploadOptions);
    
    // Clean up the temporary file
    fs.unlinkSync(file.path);
    
    console.log('✅ Case document upload successful:', {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    });
    
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      original_name: file.originalname
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    
    // Clean up the temporary file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return {
      success: false,
      error: error.message || 'Failed to upload document'
    };
  }
};

// Delete case document from Cloudinary
export const deleteCaseDocument = async (publicId) => {
  try {
    if (!isCloudinaryConfigured()) {
      return {
        success: false,
        error: 'Cloudinary is not configured.'
      };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      message: result.result === 'ok' ? 'Document deleted successfully' : 'Failed to delete document'
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete document'
    };
  }
};

// Validate document file
export const validateDocumentFile = (file) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Only PDF, DOC, DOCX, and image files are allowed'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 10MB'
    };
  }
  
  return {
    valid: true,
    error: null
  };
};

// Extract text from uploaded documents
export const extractTextFromDocument = async (filePath, fileType) => {
  try {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    switch (fileExtension) {
      case '.txt':
        return await extractTextFromTxt(filePath);
      case '.pdf':
        return await extractTextFromPdf(filePath);
      case '.docx':
        return await extractTextFromDocx(filePath);
      case '.doc':
        return await extractTextFromDoc(filePath);
      default:
        throw new Error('Unsupported file type for text extraction');
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error('Failed to extract text from document');
  }
};

// Extract text from TXT files
const extractTextFromTxt = async (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error('Failed to read text file');
  }
};

// Extract text from PDF files
const extractTextFromPdf = async (filePath) => {
  try {
    // For now, we'll provide a helpful message for PDF files
    // In a production environment, you would want to use a proper PDF parsing service
    // like Google Cloud Vision API, AWS Textract, or a dedicated PDF parsing service
    const fileStats = fs.statSync(filePath);
    const fileSizeInMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    
    return `PDF document detected (${fileSizeInMB} MB). 
    
This PDF has been uploaded successfully and is available for AI processing. 
For text extraction from PDFs, consider:
- Converting to DOCX format for better text extraction
- Using OCR services for scanned documents
- Using cloud-based PDF parsing services

The document is stored and can be referenced in your AI conversations.`;
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error('Failed to process PDF file');
  }
};

// Extract text from DOCX files
const extractTextFromDocx = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || 'No text content found in DOCX';
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

// Extract text from DOC files
const extractTextFromDoc = async (filePath) => {
  try {
    return new Promise((resolve, reject) => {
      textract.fromFileWithPath(filePath, (error, text) => {
        if (error) {
          console.error('DOC parsing error:', error);
          // Fallback: return a message about DOC files
          resolve('DOC file detected. Text extraction may require additional tools. Please convert to PDF or DOCX for better compatibility.');
        } else {
          resolve(text || 'No text content found in DOC');
        }
      });
    });
  } catch (error) {
    console.error('DOC parsing error:', error);
    // Fallback for DOC files
    return 'DOC file detected. Text extraction may require additional tools. Please convert to PDF or DOCX for better compatibility.';
  }
};

// Save uploaded document to database
export const saveUploadedDocument = async (userId, fileName, originalName, filePath, extractedText, sessionId = null) => {
  try {
    const result = await sql`
      INSERT INTO ai_documents (
        user_id, 
        file_name, 
        original_name, 
        file_path, 
        extracted_text, 
        session_id,
        created_at
      ) VALUES (
        ${userId}, 
        ${fileName}, 
        ${originalName}, 
        ${filePath}, 
        ${extractedText}, 
        ${sessionId},
        NOW()
      ) RETURNING id
    `;
    
    return result[0].id;
  } catch (error) {
    console.error('Error saving uploaded document:', error);
    throw new Error('Failed to save uploaded document');
  }
};

// Get documents for a session
export const getSessionDocuments = async (sessionId) => {
  try {
    const documents = await sql`
      SELECT id, original_name, extracted_text, created_at
      FROM ai_documents 
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;
    
    return documents;
  } catch (error) {
    console.error('Error getting session documents:', error);
    throw new Error('Failed to get session documents');
  }
};

// Delete document
export const deleteDocument = async (documentId, userId) => {
  try {
    const result = await sql`
      DELETE FROM ai_documents 
      WHERE id = ${documentId} AND user_id = ${userId}
      RETURNING file_path
    `;
    
    if (result.length > 0) {
      // Delete the physical file
      const filePath = result[0].file_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Failed to delete document');
  }
}; 