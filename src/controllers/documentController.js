import { sql } from '../config/db.js';

// Document templates with prompts for AI generation
const documentTemplates = {
  'nda': {
    name: 'Non-Disclosure Agreement',
    prompt: `Generate a professional Non-Disclosure Agreement (NDA) based on the following information:

Company Name: {companyName}
Company Jurisdiction: {companyJurisdiction}
Recipient Name: {recipientName}
Recipient Email: {recipientEmail}
Effective Date: {effectiveDate}
Confidential Information: {confidentialInfo}
Agreement Duration: {duration}

Please create a comprehensive, legally sound NDA that includes:
1. Clear definitions of confidential information
2. Obligations of the receiving party
3. Term and termination clauses
4. Return of confidential materials
5. Governing law and jurisdiction
6. Severability clause
7. Entire agreement clause

Format the document professionally with proper legal language and structure.`
  },
  'employment-contract': {
    name: 'Employment Contract',
    prompt: `Generate a professional Employment Contract based on the following information:

Employer Name: {employerName}
Employer Jurisdiction: {employerJurisdiction}
Employee Name: {employeeName}
Job Title: {jobTitle}
Start Date: {startDate}
Annual Salary: {salary}
Work Location: {workLocation}
Job Description: {jobDescription}

Please create a comprehensive employment contract that includes:
1. Position and duties
2. Compensation and benefits
3. Work schedule and location
4. Term of employment
5. Termination clauses
6. Confidentiality and non-compete provisions
7. Intellectual property rights
8. Governing law and dispute resolution
9. Entire agreement clause

Format the document professionally with proper legal language and structure.`
  },
  'rental-agreement': {
    name: 'Rental Agreement',
    prompt: `Generate a professional Rental/Lease Agreement based on the following information:

Landlord Name: {landlordName}
Tenant Name: {tenantName}
Property Address: {propertyAddress}
Monthly Rent: {rentAmount}
Lease Start Date: {leaseStart}
Lease End Date: {leaseEnd}
Security Deposit: {securityDeposit}
Jurisdiction: {jurisdiction}

Please create a comprehensive rental agreement that includes:
1. Property description and use
2. Term of lease
3. Rent amount and payment terms
4. Security deposit terms
5. Utilities and maintenance responsibilities
6. Rules and regulations
7. Entry and inspection rights
8. Default and termination clauses
9. Governing law and jurisdiction
10. Entire agreement clause

Format the document professionally with proper legal language and structure.`
  },
  'service-agreement': {
    name: 'Service Agreement',
    prompt: `Generate a professional Service Agreement based on the following information:

Service Provider: {serviceProvider}
Provider Jurisdiction: {providerJurisdiction}
Client Name: {clientName}
Service Description: {serviceDescription}
Service Fee: {serviceFee}
Service Start Date: {startDate}
Service End Date: {endDate}
Payment Terms: {paymentTerms}

Please create a comprehensive service agreement that includes:
1. Scope of services
2. Service provider obligations
3. Client obligations
4. Compensation and payment terms
5. Term and termination
6. Intellectual property rights
7. Confidentiality provisions
8. Limitation of liability
9. Dispute resolution
10. Governing law and jurisdiction
11. Entire agreement clause

Format the document professionally with proper legal language and structure.`
  }
};

// Generate document using DeepSeek R1 AI model
async function generateDocumentWithAI(templateId, formData) {
  console.log('generateDocumentWithAI called with templateId:', templateId);
  
  const template = documentTemplates[templateId];
  if (!template) {
    console.error('Template not found for ID:', templateId);
    throw new Error('Invalid template ID');
  }

  console.log('Template found:', template.name);

  // Replace placeholders in the prompt with form data
  let prompt = template.prompt;
  console.log('Original prompt length:', prompt.length);
  
  Object.keys(formData).forEach(key => {
    const placeholder = `{${key}}`;
    const value = formData[key] || '';
    prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    console.log(`Replaced ${placeholder} with: ${value}`);
  });

  console.log('Final prompt length:', prompt.length);

  try {
    console.log('Making request to OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
        'X-Title': 'advoqat Document Generator'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages: [
          {
            role: 'system',
            content: 'You are a professional legal document generator. Create comprehensive, legally sound documents based on the provided information. Use proper legal language and structure.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      })
    });

    console.log('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      throw new Error(`Failed to generate document with AI: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenRouter API response received, choices:', data.choices?.length || 0);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response from OpenRouter API:', data);
      throw new Error('Invalid response from AI service');
    }
    
    const content = data.choices[0].message.content;
    console.log('Generated document content length:', content.length);
    
    return content;
  } catch (error) {
    console.error('Error generating document with AI:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to generate document with AI: ${error.message}`);
  }
}

// POST /api/v1/documents/generate - Generate a new document
export const generateDocument = async (req, res) => {
  try {
    const { templateId, formData, userId, paymentSessionId } = req.body;
    
    console.log('generateDocument called with:', { templateId, userId, formDataKeys: Object.keys(formData || {}), paymentSessionId });
    
    // Validate required fields
    if (!templateId || !formData || !userId) {
      console.error('Missing required fields:', { templateId: !!templateId, formData: !!formData, userId: !!userId });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate template exists
    if (!documentTemplates[templateId]) {
      console.error('Invalid template ID:', templateId);
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    console.log('Template found:', documentTemplates[templateId].name);

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      console.error('User not found for supabase_id:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found with ID:', user[0].id);

    // Generate document using AI
    console.log('Generating document with AI...');
    const generatedDocument = await generateDocumentWithAI(templateId, formData);
    console.log('Document generated successfully, length:', generatedDocument.length);
    
    // Save to database with appropriate payment status
    console.log('Saving document to database...');
    
    let paymentStatus = 'pending';
    let paidAt = null;
    
    // If payment session ID is provided, verify payment and mark as paid
    if (paymentSessionId) {
      try {
        const stripe = (await import('../config/stripe.js')).default;
        const session = await stripe.checkout.sessions.retrieve(paymentSessionId);
        
        if (session.payment_status === 'paid') {
          paymentStatus = 'paid';
          paidAt = new Date();
        }
      } catch (error) {
        console.error('Error verifying payment session:', error);
      }
    }
    
    const result = await sql`
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
        paid_at
      ) VALUES (
        ${user[0].id}, 
        ${templateId}, 
        ${documentTemplates[templateId].name}, 
        ${JSON.stringify(formData)}, 
        ${generatedDocument}, 
        ${templateId},
        1000,
        ${paymentStatus},
        ${paymentSessionId || null},
        ${paidAt}
      )
      RETURNING id, created_at
    `;

    console.log('Document saved to database with ID:', result[0].id);

    res.status(201).json({
      success: true,
      document: generatedDocument,
      documentId: result[0].id,
      message: 'Document generated successfully'
    });
  } catch (error) {
    console.error('Error generating document:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate document',
      details: error.message 
    });
  }
};

// GET /api/v1/documents/user - Get user's documents
export const getUserDocuments = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const documents = await sql`
      SELECT 
        id,
        template_id,
        template_name,
        form_data,
        generated_document,
        document_type,
        document_fee,
        payment_status,
        payment_session_id,
        paid_at,
        download_count,
        status,
        created_at
      FROM documents 
      WHERE user_id = ${user[0].id} AND status != 'deleted'
      ORDER BY created_at DESC
    `;
    
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

// GET /api/v1/documents/:id - Get specific document
export const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    console.log('Fetching document:', id, 'for user:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      console.log('User not found for supabase_id:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Found user with ID:', user[0].id);
    
    const documents = await sql`
      SELECT 
        id,
        template_id,
        template_name,
        form_data,
        generated_document,
        document_type,
        document_fee,
        payment_status,
        payment_session_id,
        paid_at,
        download_count,
        status,
        created_at
      FROM documents 
      WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
    `;
    
    console.log('Found documents:', documents.length);
    
    if (documents.length === 0) {
      console.log('Document not found for ID:', id, 'and user_id:', user[0].id);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = documents[0];
    console.log('Document payment status:', document.payment_status);
    
    res.json({
      success: true,
      document: document
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

// DELETE /api/v1/documents/:id - Delete document (soft delete)
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await sql`
      UPDATE documents 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user[0].id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// GET /api/v1/documents/templates - Get available templates
export const getDocumentTemplates = async (req, res) => {
  try {
    const templates = Object.keys(documentTemplates).map(id => ({
      id,
      name: documentTemplates[id].name,
      description: documentTemplates[id].description || '',
      category: getTemplateCategory(id),
      icon: getTemplateIcon(id)
    }));
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

// Helper functions
function getTemplateCategory(templateId) {
  const categories = {
    'nda': 'Business',
    'employment-contract': 'Employment',
    'rental-agreement': 'Real Estate',
    'service-agreement': 'Business'
  };
  return categories[templateId] || 'General';
}

function getTemplateIcon(templateId) {
  const icons = {
    'nda': '📄',
    'employment-contract': '👔',
    'rental-agreement': '🏠',
    'service-agreement': '🤝'
  };
  return icons[templateId] || '📋';
}

// POST /api/v1/documents/:id/create-payment - Create payment session for document
export const createDocumentPayment = async (req, res) => {
  try {
    console.log('Creating payment session for document:', req.params.id);
    console.log('Request body:', req.body);
    
    const { id } = req.params;
    const { userId, templateId, formData, generatedDocument } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY environment variable is not set');
      return res.status(500).json({ error: 'Payment system configuration error' });
    }
    
    if (!process.env.FRONTEND_URL) {
      console.error('FRONTEND_URL environment variable is not set');
      return res.status(500).json({ error: 'Frontend URL configuration error' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let document;
    let documentFee = 999; // Default fee for generated documents ($9.99)
    let templateName = 'Generated Document';
    
    // Handle generated document payment (when id is 'temp')
    if (id === 'temp') {
      if (!templateId || !formData || !generatedDocument) {
        return res.status(400).json({ error: 'Template ID, form data, and generated document are required for generated document payment' });
      }
      
      // Get template details
      const templates = await sql`
        SELECT name, document_fee FROM document_templates WHERE id = ${templateId}
      `;
      
      if (templates.length > 0) {
        templateName = templates[0].name;
        documentFee = templates[0].document_fee || 999;
      }
      
      document = {
        id: 'temp',
        template_name: templateName,
        document_fee: documentFee,
        payment_status: 'pending'
      };
    } else {
      // Handle existing document payment
      const documents = await sql`
        SELECT 
          id,
          template_name,
          document_fee,
          payment_status
        FROM documents 
        WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
      `;
      
      if (documents.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      document = documents[0];
      
      // Check if already paid
      if (document.payment_status === 'paid') {
        return res.status(400).json({ 
          error: 'Document has already been paid for',
          canDownload: true
        });
      }
    }
    
    // Import stripe from payment controller
    console.log('Importing Stripe configuration...');
    const stripe = (await import('../config/stripe.js')).default;
    console.log('Stripe imported successfully');
    
    // Create payment intent
    console.log('Creating payment intent for amount:', document.document_fee);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: document.document_fee,
      currency: 'usd',
      metadata: {
        documentId: id,
        userId: user[0].id.toString(), // Use database user ID
        documentName: document.template_name,
      },
    });
    console.log('Payment intent created:', paymentIntent.id);
    
    // Create checkout session
    console.log('Creating checkout session...');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Legal Document: ${document.template_name}`,
              description: `Download access for generated legal document`,
            },
            unit_amount: document.document_fee,
          },
          quantity: 1,
        },
      ],
      metadata: {
        documentId: id,
        userId: user[0].id.toString(), // Use database user ID
        documentName: document.template_name,
        paymentIntentId: paymentIntent.id,
        isGeneratedDocument: id === 'temp' ? 'true' : 'false',
        templateId: templateId || null,
        formData: formData ? JSON.stringify(formData) : null,
        generatedDocument: generatedDocument || null,
      },
      mode: 'payment',
      success_url: id === 'temp' 
        ? `${process.env.FRONTEND_URL}/dashboard/documents?payment=success&session_id={CHECKOUT_SESSION_ID}&generated=true`
        : `${process.env.FRONTEND_URL}/dashboard/documents/${id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: id === 'temp'
        ? `${process.env.FRONTEND_URL}/dashboard/documents?payment=cancelled`
        : `${process.env.FRONTEND_URL}/dashboard/documents/${id}?payment=cancelled`,
    });
    
    // Update document with payment session info (only for existing documents)
    if (id !== 'temp') {
      await sql`
        UPDATE documents 
        SET payment_session_id = ${session.id}, payment_intent_id = ${paymentIntent.id}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    
    res.json({
      success: true,
      sessionId: session.id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      url: session.url,
      documentFee: document.document_fee
    });
  } catch (error) {
    console.error('Error creating document payment:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};

// POST /api/v1/documents/:id/verify-payment - Verify payment and enable download
export const verifyDocumentPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, userId } = req.body;
    
    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'Session ID and User ID are required' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Import stripe from payment controller
    const stripe = (await import('../config/stripe.js')).default;
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('Stripe session payment status:', session.payment_status);
    console.log('Session metadata:', session.metadata);
    
    if (session.payment_status === 'paid') {
      // Update document payment status
      const updateResult = await sql`
        UPDATE documents 
        SET payment_status = 'paid', paid_at = NOW(), updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user[0].id}
        RETURNING id, payment_status
      `;
      
      console.log('Document payment update result:', updateResult);
      
      if (updateResult.length > 0) {
        res.json({
          success: true,
          paid: true,
          canDownload: true,
          message: 'Payment verified successfully'
        });
      } else {
        res.json({
          success: false,
          paid: false,
          canDownload: false,
          message: 'Document not found or update failed'
        });
      }
    } else {
      res.json({
        success: true,
        paid: false,
        canDownload: false,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    console.error('Error verifying document payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// GET /api/v1/documents/:id/download - Secure document download with payment verification
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, format = 'pdf' } = req.query;
    
    console.log('Download request for document:', id, 'format:', format, 'user:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Validate format
    const validFormats = ['pdf', 'docx', 'txt'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported formats: pdf, docx, txt' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get document with payment verification
    const documents = await sql`
      SELECT 
        id,
        template_name,
        generated_document,
        payment_status,
        download_count
      FROM documents 
      WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
    `;
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = documents[0];
    
    // Verify payment before allowing download
    if (document.payment_status !== 'paid') {
      return res.status(403).json({ 
        error: 'Payment required before download',
        paymentRequired: true,
        paymentStatus: document.payment_status
      });
    }
    
    // Increment download count
    await sql`
      UPDATE documents 
      SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = ${id}
    `;
    
    // Log the export
    console.log(`Document ${id} exported in ${format} format by user ${userId}`);
    
    // Return document content for download
    res.json({
      success: true,
      document: {
        id: document.id,
        name: document.template_name,
        content: document.generated_document,
        downloadCount: document.download_count + 1,
        format: format
      }
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
};

// Helper function to update document payment status (called from webhook)
export const updateDocumentPayment = async (documentId, paymentData) => {
  try {
    await sql`
      UPDATE documents 
      SET 
        payment_status = ${paymentData.paymentStatus},
        paid_at = ${paymentData.paymentStatus === 'paid' ? sql`NOW()` : null},
        updated_at = NOW()
      WHERE id = ${documentId}
    `;
    
    console.log(`Document ${documentId} payment status updated to ${paymentData.paymentStatus}`);
  } catch (error) {
    console.error('Error updating document payment:', error);
    throw error;
  }
}; 

// GET /api/v1/documents/recent - Get recent documents for user
export const getRecentDocuments = async (req, res) => {
  try {
    const { userId, limit = 3, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent documents for the user with pagination
    const documents = await sql`
      SELECT 
        id,
        template_name,
        payment_status as status,
        created_at,
        updated_at
      FROM documents 
      WHERE user_id = ${user[0].id}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    // Get total count for pagination
    const totalCount = await sql`
      SELECT COUNT(*) as total
      FROM documents 
      WHERE user_id = ${user[0].id}
    `;

    res.json({
      success: true,
      documents: documents,
      total: totalCount[0]?.total || 0,
      hasMore: (parseInt(offset) + parseInt(limit)) < (totalCount[0]?.total || 0)
    });
  } catch (error) {
    console.error('Error fetching recent documents:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch recent documents',
      details: error.message 
    });
  }
}; 