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
  const template = documentTemplates[templateId];
  if (!template) {
    throw new Error('Invalid template ID');
  }

  // Replace placeholders in the prompt with form data
  let prompt = template.prompt;
  Object.keys(formData).forEach(key => {
    const placeholder = `{${key}}`;
    prompt = prompt.replace(new RegExp(placeholder, 'g'), formData[key] || '');
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
        'X-Title': 'LegaliQ Document Generator'
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      throw new Error('Failed to generate document with AI');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating document with AI:', error);
    throw new Error('Failed to generate document with AI');
  }
}

// POST /api/v1/documents/generate - Generate a new document
export const generateDocument = async (req, res) => {
  try {
    const { templateId, formData, userId } = req.body;
    
    console.log('generateDocument called with:', { templateId, userId });
    
    // Validate required fields
    if (!templateId || !formData || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate template exists
    if (!documentTemplates[templateId]) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate document using AI
    const generatedDocument = await generateDocumentWithAI(templateId, formData);
    
    // Save document to database
    const [document] = await sql`
      INSERT INTO documents (
        user_id, 
        template_id, 
        template_name, 
        form_data, 
        generated_document, 
        document_type
      )
      VALUES (
        ${user[0].id}, 
        ${templateId}, 
        ${documentTemplates[templateId].name}, 
        ${JSON.stringify(formData)}, 
        ${generatedDocument}, 
        ${templateId}
      )
      RETURNING id, created_at
    `;

    res.status(201).json({
      success: true,
      document: generatedDocument,
      documentId: document.id,
      message: 'Document generated successfully'
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document' });
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
        status,
        created_at
      FROM documents 
      WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
    `;
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      success: true,
      document: documents[0]
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