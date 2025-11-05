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

// Get documents by user ID
export async function getUserDocuments(req, res) {
    const { userId } = req.query;
    
    try {
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        console.log('Fetching documents for userId:', userId);

        // Use userId directly as backend user ID (no longer using Supabase)
        const backendUserId = parseInt(userId);
        
        if (isNaN(backendUserId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Verify user exists
        const userCheck = await sql`
            SELECT id FROM "user" 
            WHERE id = ${backendUserId}
        `;

        if (!userCheck.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('Found user with numeric ID:', backendUserId);

        // Get all cases for the user (as client)
        const userCases = await sql`
            SELECT 
                c.id,
                c.title,
                c.case_summary_url,
                c.annotated_document_url,
                c.auto_generated_docs,
                c.created_at,
                c.updated_at
            FROM "case" c
            WHERE c.client_id = ${backendUserId}
            ORDER BY c.created_at DESC
        `;

        console.log('Found cases:', userCases.length);

        // Get all AI documents for the user
        const aiDocuments = await sql`
            SELECT 
                id,
                user_id,
                file_name,
                original_name,
                file_path,
                extracted_text,
                created_at,
                updated_at
            FROM ai_documents
            WHERE user_id = ${backendUserId}
            ORDER BY created_at DESC
        `;

        console.log('Found AI documents:', aiDocuments.length);

        // Format case documents
        const caseDocuments = userCases.flatMap(caseItem => {
            const documents = [];
            
            // Add case summary document if it exists
            if (caseItem.case_summary_url) {
                documents.push({
                    id: `case-${caseItem.id}-summary`,
                    user_id: backendUserId,
                    template_id: 'case-summary',
                    template_name: caseItem.title || 'Case Summary',
                    form_data: {},
                    generated_document: caseItem.case_summary_url,
                    document_type: 'case_summary',
                    document_fee: 0,
                    payment_status: 'paid',
                    download_count: 0,
                    status: 'active',
                    created_at: caseItem.created_at
                });
            }
            
            // Add annotated document if it exists
            if (caseItem.annotated_document_url) {
                documents.push({
                    id: `case-${caseItem.id}-annotated`,
                    user_id: backendUserId,
                    template_id: 'case-annotated',
                    template_name: `${caseItem.title || 'Case'} - Annotated`,
                    form_data: {},
                    generated_document: caseItem.annotated_document_url,
                    document_type: 'case_annotated',
                    document_fee: 0,
                    payment_status: 'paid',
                    download_count: 0,
                    status: 'active',
                    created_at: caseItem.updated_at || caseItem.created_at
                });
            }
            
            // Add auto-generated documents if they exist
            if (caseItem.auto_generated_docs && Array.isArray(caseItem.auto_generated_docs)) {
                caseItem.auto_generated_docs.forEach((doc, index) => {
                    documents.push({
                        id: `case-${caseItem.id}-auto-${index}`,
                        user_id: backendUserId,
                        template_id: 'auto-generated',
                        template_name: doc.name || `${caseItem.title || 'Case'} - Auto Generated ${index + 1}`,
                        form_data: {},
                        generated_document: doc.url || doc.path || '',
                        document_type: doc.type || 'auto_generated',
                        document_fee: 0,
                        payment_status: 'paid',
                        download_count: 0,
                        status: 'active',
                        created_at: caseItem.created_at
                    });
                });
            }
            
            return documents;
        });

        // Format AI documents to match DocumentRecord interface
        const formattedAiDocuments = aiDocuments.map(doc => ({
            id: `ai-${doc.id}`,
            user_id: doc.user_id,
            template_id: 'ai-document',
            template_name: doc.original_name || doc.file_name,
            form_data: {},
            generated_document: doc.file_path,
            document_type: 'ai_document',
            document_fee: 0,
            payment_status: 'paid',
            download_count: 0,
            status: 'active',
            created_at: doc.created_at
        }));

        // Combine all documents
        const allDocuments = [...caseDocuments, ...formattedAiDocuments];

        console.log('Total documents found:', allDocuments.length);

        res.json({
            success: true,
            documents: allDocuments,
            total: allDocuments.length,
            caseDocuments: caseDocuments.length,
            aiDocuments: formattedAiDocuments.length
        });
    } catch (error) {
        console.error('Error fetching user documents:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user documents',
            details: error.message,
            stack: error.stack
        });
    }
} 