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

        // First, check if the user exists and get their numeric ID
        // Handle numeric ID, UUID (supabase_id), or email
        let userCheck;
        const userIdString = String(userId);
        
        if (userIdString.includes('-')) {
            // It's a UUID (supabase_id)
            console.log('Checking for UUID user:', userIdString);
            userCheck = await sql`
                SELECT id, supabase_id FROM "user" 
                WHERE supabase_id = ${userIdString}
            `;
        } else {
            // Check if it's a valid numeric ID
            const numericId = parseInt(userIdString, 10);
            if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
                // It's a valid numeric ID
                console.log('Checking for numeric user ID:', numericId);
                userCheck = await sql`
                    SELECT id, supabase_id FROM "user" 
                    WHERE id = ${numericId}
                `;
            } else if (userIdString.includes('@')) {
                // It might be an email address
                console.log('Checking for user by email:', userIdString);
                userCheck = await sql`
                    SELECT id, supabase_id FROM "user" 
                    WHERE email = ${userIdString}
                `;
            } else {
                // Invalid format
                console.log('Invalid userId format:', userIdString);
                return res.status(400).json({ error: 'Invalid userId format. Expected numeric ID, UUID, or email address.' });
            }
        }

        if (!userCheck.length) {
            console.log('User not found for userId:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        const numericUserId = userCheck[0].id;
        console.log('Found user with numeric ID:', numericUserId);

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
            WHERE c.client_id = ${numericUserId}
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
            WHERE user_id = ${numericUserId}
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
                    user_id: numericUserId,
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
                    user_id: numericUserId,
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
                        user_id: numericUserId,
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

        // Get user-generated documents (from documents table)
        const userGeneratedDocuments = await sql`
            SELECT 
                id,
                user_id,
                template_id,
                template_name,
                form_data,
                generated_document,
                document_type,
                document_fee,
                payment_status,
                download_count,
                status,
                created_at
            FROM documents
            WHERE user_id = ${numericUserId} AND status != 'deleted'
            ORDER BY created_at DESC
        `;

        console.log('Found user-generated documents:', userGeneratedDocuments.length);

        // Combine all documents
        const allDocuments = [...userGeneratedDocuments, ...caseDocuments, ...formattedAiDocuments];

        console.log('Total documents found:', allDocuments.length);

        res.json({
            success: true,
            documents: allDocuments,
            total: allDocuments.length,
            userUploadedCount: userGeneratedDocuments.length,
            receivedCount: caseDocuments.length + formattedAiDocuments.length,
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

// Generate document using AI
async function generateAIResponse(messages, model = 'tngtech/deepseek-r1t2-chimera:free') {
    try {
        // Check if API key is configured
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('OPENROUTER_API_KEY is not set in environment variables');
            throw new Error('OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your .env file.');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'AdvoQat Document Generator'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: 4000,
                temperature: 0.7,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenRouter API error:', errorData);
            console.error('Response status:', response.status);
            console.error('API Key present:', !!apiKey);
            console.error('API Key length:', apiKey ? apiKey.length : 0);
            
            // Provide more specific error message
            if (response.status === 401) {
                throw new Error('OpenRouter API authentication failed. Please check your OPENROUTER_API_KEY in .env file.');
            }
            throw new Error(`OpenRouter API error: ${errorData}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            tokens_used: data.usage?.total_tokens || 0,
            model_used: model
        };
    } catch (error) {
        console.error('Error generating AI response:', error);
        throw error; // Re-throw to preserve original error message
    }
}

// Generate document prompt based on template
function getDocumentPrompt(templateId, formData) {
    const prompts = {
        'nda': `Generate a professional Non-Disclosure Agreement (NDA) with the following details:
- Company Name: ${formData.companyName || 'N/A'}
- Company Jurisdiction: ${formData.companyJurisdiction || 'N/A'}
- Recipient Name: ${formData.recipientName || 'N/A'}
- Recipient Email: ${formData.recipientEmail || 'N/A'}
- Effective Date: ${formData.effectiveDate || 'N/A'}
- Confidential Information: ${formData.confidentialInfo || 'N/A'}
- Agreement Duration: ${formData.duration || 'N/A'}

Create a comprehensive, legally sound NDA that includes:
1. Clear definition of confidential information
2. Obligations of the receiving party
3. Exceptions to confidentiality
4. Term and termination clauses
5. Return of materials
6. Governing law clause
7. Signatures section

Format it professionally with proper legal language and structure.`,

        'employment-contract': `Generate a professional Employment Contract with the following details:
- Employer Name: ${formData.employerName || 'N/A'}
- Employer Jurisdiction: ${formData.employerJurisdiction || 'N/A'}
- Employee Name: ${formData.employeeName || 'N/A'}
- Job Title: ${formData.jobTitle || 'N/A'}
- Start Date: ${formData.startDate || 'N/A'}
- Annual Salary: ${formData.salary || 'N/A'}
- Work Location: ${formData.workLocation || 'N/A'}
- Job Description: ${formData.jobDescription || 'N/A'}

Create a comprehensive employment contract that includes:
1. Position and duties
2. Compensation and benefits
3. Work schedule and location
4. Term of employment
5. Confidentiality and non-compete clauses
6. Termination conditions
7. Governing law
8. Signatures section

Format it professionally with proper legal language.`,

        'rental-agreement': `Generate a professional Rental/Lease Agreement with the following details:
- Landlord Name: ${formData.landlordName || 'N/A'}
- Tenant Name: ${formData.tenantName || 'N/A'}
- Property Address: ${formData.propertyAddress || 'N/A'}
- Monthly Rent: ${formData.rentAmount || 'N/A'}
- Lease Start Date: ${formData.leaseStart || 'N/A'}
- Lease End Date: ${formData.leaseEnd || 'N/A'}
- Security Deposit: ${formData.securityDeposit || 'N/A'}
- Jurisdiction: ${formData.jurisdiction || 'N/A'}

Create a comprehensive rental agreement that includes:
1. Property description
2. Term and rent amount
3. Security deposit terms
4. Tenant and landlord obligations
5. Maintenance and repairs
6. Utilities and services
7. Default and termination
8. Governing law
9. Signatures section

Format it professionally with proper legal language.`,

        'service-agreement': `Generate a professional Service Agreement with the following details:
- Service Provider: ${formData.serviceProvider || 'N/A'}
- Provider Jurisdiction: ${formData.providerJurisdiction || 'N/A'}
- Client Name: ${formData.clientName || 'N/A'}
- Service Description: ${formData.serviceDescription || 'N/A'}
- Service Fee: ${formData.serviceFee || 'N/A'}
- Start Date: ${formData.startDate || 'N/A'}
- End Date: ${formData.endDate || 'N/A'}
- Payment Terms: ${formData.paymentTerms || 'N/A'}

Create a comprehensive service agreement that includes:
1. Services to be provided
2. Compensation and payment terms
3. Term and duration
4. Responsibilities of both parties
5. Intellectual property rights
6. Confidentiality
7. Termination conditions
8. Governing law
9. Signatures section

Format it professionally with proper legal language.`
    };

    return prompts[templateId] || `Generate a professional legal document based on the following form data: ${JSON.stringify(formData, null, 2)}`;
}

// POST /api/v1/documents/generate - Generate a document
export async function generateDocument(req, res) {
    try {
        const { templateId, formData, userId, paymentSessionId } = req.body;

        if (!templateId || !formData || !userId) {
            return res.status(400).json({ 
                error: 'Missing required fields: templateId, formData, and userId are required' 
            });
        }

        console.log('Generating document:', { templateId, userId, hasFormData: !!formData });

        // Handle both numeric ID and UUID (supabase_id)
        let userCheck;
        const userIdString = String(userId);
        
        if (userIdString.includes('-')) {
            // It's a UUID (supabase_id)
            userCheck = await sql`
                SELECT id FROM "user" 
                WHERE supabase_id = ${userIdString}
            `;
        } else {
            // It's a numeric ID
            const numericId = parseInt(userIdString, 10);
            if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
                userCheck = await sql`
                    SELECT id FROM "user" 
                    WHERE id = ${numericId}
                `;
            } else {
                return res.status(400).json({ error: 'Invalid userId format' });
            }
        }
        
        if (!userCheck.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const numericUserId = userCheck[0].id;

        // Get template name
        const templateNames = {
            'nda': 'Non-Disclosure Agreement',
            'employment-contract': 'Employment Contract',
            'rental-agreement': 'Rental Agreement',
            'service-agreement': 'Service Agreement'
        };
        const templateName = templateNames[templateId] || templateId;

        // Generate document using AI
        const prompt = getDocumentPrompt(templateId, formData);
        const messages = [
            {
                role: 'system',
                content: 'You are a professional legal document generator. Generate comprehensive, legally sound documents with proper structure, formatting, and legal language. Include all necessary clauses and sections.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        let generatedDocument;
        try {
            const aiResponse = await generateAIResponse(messages);
            generatedDocument = aiResponse.content;
        } catch (aiError) {
            console.error('AI generation failed:', aiError);
            // Return a more user-friendly error
            return res.status(500).json({
                error: 'Failed to generate document',
                details: aiError.message || 'AI service is currently unavailable. Please check your OpenRouter API key configuration.',
                suggestion: 'Please ensure OPENROUTER_API_KEY is set in your backend .env file'
            });
        }

        // Save document immediately (with pending payment status if no paymentSessionId)
        const paymentStatus = paymentSessionId ? 'paid' : 'pending';
        const [document] = await sql`
            INSERT INTO documents (
                user_id,
                template_id,
                template_name,
                form_data,
                generated_document,
                document_type,
                document_fee,
                payment_status,
                payment_session_id,
                status
            )
            VALUES (
                ${numericUserId},
                ${templateId},
                ${templateName},
                ${JSON.stringify(formData)},
                ${generatedDocument},
                ${templateId},
                0, -- Default fee, can be updated later
                ${paymentStatus},
                ${paymentSessionId || null},
                'active'
            )
            RETURNING *
        `;

        return res.json({
            success: true,
            document: generatedDocument,
            documentId: document.id,
            templateId,
            templateName,
            paymentStatus: paymentStatus,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error generating document:', error);
        res.status(500).json({ 
            error: 'Failed to generate document',
            details: error.message 
        });
    }
}