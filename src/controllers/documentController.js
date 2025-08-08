import { sql } from "../config/db.js";
import { uploadCaseDocument as uploadToCloudinary, deleteCaseDocument as deleteFromCloudinary, validateDocumentFile } from "../utils/fileUpload.js";

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get documents for a case
export async function getCaseDocuments(req, res) {
    const { caseId } = req.params;
    
    try {
        // Get case details with documents
        const caseData = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                f.name as freelancer_name,
                f.email as freelancer_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
            WHERE c.id = ${caseId}
        `;

        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseItem = caseData[0];
        const documents = [];

        // Add original case document if exists
        if (caseItem.case_summary_url) {
            documents.push({
                id: 'original',
                name: `Case Document - ${caseItem.title}`,
                type: 'original',
                url: caseItem.case_summary_url,
                size: '2.3 MB', // This would come from Cloudinary metadata
                uploaded_at: caseItem.created_at,
                description: 'Original case document submitted by client'
            });
        }

        // Add annotated document if exists
        if (caseItem.annotated_document_url) {
            documents.push({
                id: 'annotated',
                name: 'Annotated Document',
                type: 'annotated',
                url: caseItem.annotated_document_url,
                size: '1.8 MB',
                uploaded_at: caseItem.updated_at || caseItem.created_at,
                description: 'Lawyer annotated version of the case document'
            });
        }

        // Add auto-generated documents if available
        if (caseItem.auto_generated_docs && caseItem.auto_generated_docs.length > 0) {
            caseItem.auto_generated_docs.forEach((doc, index) => {
                documents.push({
                    id: `auto-${index + 1}`,
                    name: doc.name || `Auto-Generated Document ${index + 1}`,
                    type: 'auto_generated',
                    url: doc.url,
                    size: doc.size || '1.1 MB',
                    uploaded_at: doc.uploaded_at || new Date().toISOString(),
                    description: doc.description || 'System-generated document based on case details'
                });
            });
        }

        res.json({
            case: caseItem,
            documents: documents
        });
    } catch (error) {
        console.error('Error fetching case documents:', error);
        res.status(500).json({ error: 'Failed to fetch case documents' });
    }
}

// Upload additional document to case
export async function uploadCaseDocument(req, res) {
    const { caseId } = req.params;
    const { documentType = 'additional' } = req.body;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate file
        const validation = validateDocumentFile(req.file);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file, caseId, documentType);
        
        if (!uploadResult.success) {
            return res.status(500).json({ error: uploadResult.error });
        }

        // Update case with new document URL
        let updateQuery;
        if (documentType === 'annotated') {
            updateQuery = sql`
                UPDATE "case" 
                SET annotated_document_url = ${uploadResult.url},
                    updated_at = NOW()
                WHERE id = ${caseId}
                RETURNING *
            `;
        } else {
            // Add to auto_generated_docs array
            updateQuery = sql`
                UPDATE "case" 
                SET auto_generated_docs = COALESCE(auto_generated_docs, '[]'::jsonb) || ${JSON.stringify([{
                    name: req.file.originalname,
                    url: uploadResult.url,
                    size: formatFileSize(uploadResult.size),
                    type: documentType,
                    uploaded_at: new Date().toISOString()
                }])}::jsonb,
                    updated_at = NOW()
                WHERE id = ${caseId}
                RETURNING *
            `;
        }

        const updatedCase = await updateQuery;
        
        if (!updatedCase.length) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                url: uploadResult.url,
                name: req.file.originalname,
                size: formatFileSize(uploadResult.size),
                type: documentType
            },
            case: updatedCase[0]
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
}

// Delete document from case
export async function deleteCaseDocument(req, res) {
    const { caseId, documentId } = req.params;
    
    try {
        // Get case to find document URL
        const caseData = await sql`
            SELECT * FROM "case" WHERE id = ${caseId}
        `;

        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseItem = caseData[0];
        let documentUrl = null;

        // Find document URL based on documentId
        if (documentId === 'original' && caseItem.case_summary_url) {
            documentUrl = caseItem.case_summary_url;
        } else if (documentId === 'annotated' && caseItem.annotated_document_url) {
            documentUrl = caseItem.annotated_document_url;
        } else if (documentId.startsWith('auto-') && caseItem.auto_generated_docs) {
            const index = parseInt(documentId.split('-')[1]) - 1;
            if (caseItem.auto_generated_docs[index]) {
                documentUrl = caseItem.auto_generated_docs[index].url;
            }
        }

        if (!documentUrl) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Extract public_id from Cloudinary URL
        const publicId = documentUrl.split('/').pop().split('.')[0];
        
        // Delete from Cloudinary
        const deleteResult = await deleteFromCloudinary(publicId);
        
        if (!deleteResult.success) {
            console.error('Failed to delete from Cloudinary:', deleteResult.error);
        }

        // Remove from database
        let updateQuery;
        if (documentId === 'original') {
            updateQuery = sql`
                UPDATE "case" 
                SET case_summary_url = NULL,
                    updated_at = NOW()
                WHERE id = ${caseId}
                RETURNING *
            `;
        } else if (documentId === 'annotated') {
            updateQuery = sql`
                UPDATE "case" 
                SET annotated_document_url = NULL,
                    updated_at = NOW()
                WHERE id = ${caseId}
                RETURNING *
            `;
        } else if (documentId.startsWith('auto-')) {
            const index = parseInt(documentId.split('-')[1]) - 1;
            const updatedDocs = caseItem.auto_generated_docs.filter((_, i) => i !== index);
            updateQuery = sql`
                UPDATE "case" 
                SET auto_generated_docs = ${JSON.stringify(updatedDocs)}::jsonb,
                    updated_at = NOW()
                WHERE id = ${caseId}
                RETURNING *
            `;
        }

        const updatedCase = await updateQuery;
        
        res.json({
            success: true,
            message: 'Document deleted successfully',
            case: updatedCase[0]
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
}

// Get document download URL
export async function getDocumentDownloadUrl(req, res) {
    const { caseId, documentId } = req.params;
    
    try {
        const caseData = await sql`
            SELECT * FROM "case" WHERE id = ${caseId}
        `;

        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseItem = caseData[0];
        let documentUrl = null;
        let documentName = null;

        // Find document URL based on documentId
        if (documentId === 'original' && caseItem.case_summary_url) {
            documentUrl = caseItem.case_summary_url;
            documentName = `Case Document - ${caseItem.title}`;
        } else if (documentId === 'annotated' && caseItem.annotated_document_url) {
            documentUrl = caseItem.annotated_document_url;
            documentName = 'Annotated Document';
        } else if (documentId.startsWith('auto-') && caseItem.auto_generated_docs) {
            const index = parseInt(documentId.split('-')[1]) - 1;
            if (caseItem.auto_generated_docs[index]) {
                documentUrl = caseItem.auto_generated_docs[index].url;
                documentName = caseItem.auto_generated_docs[index].name;
            }
        }

        if (!documentUrl) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({
            success: true,
            downloadUrl: documentUrl,
            documentName: documentName
        });
    } catch (error) {
        console.error('Error getting document download URL:', error);
        res.status(500).json({ error: 'Failed to get document download URL' });
    }
} 