import { sql } from '../config/db.js';
import { upload, extractTextFromDocument, saveUploadedDocument, getSessionDocuments, deleteDocument } from '../utils/fileUpload.js';

// Legal topics mapping
const LEGAL_TOPICS = {
  'Contract Law': ['contract', 'agreement', 'terms', 'conditions', 'breach', 'enforcement', 'obligation', 'liability', 'clause', 'provision'],
  'Employment Law': ['employment', 'workplace', 'discrimination', 'harassment', 'wages', 'termination', 'employee', 'employer', 'labor', 'workplace rights'],
  'Real Estate': ['property', 'real estate', 'landlord', 'tenant', 'mortgage', 'deed', 'lease', 'rental', 'property law', 'housing'],
  'Business Law': ['business', 'corporate', 'LLC', 'partnership', 'tax', 'compliance', 'company', 'corporation', 'business formation', 'commercial'],
  'Family Law': ['family', 'divorce', 'custody', 'child support', 'marriage', 'adoption', 'alimony', 'prenup', 'domestic', 'spouse'],
  'Criminal Law': ['criminal', 'crime', 'arrest', 'charge', 'trial', 'sentencing', 'defense', 'prosecution', 'felony', 'misdemeanor'],
  'Intellectual Property': ['patent', 'trademark', 'copyright', 'IP', 'intellectual property', 'infringement', 'licensing', 'trade secret'],
  'Immigration Law': ['immigration', 'visa', 'citizenship', 'green card', 'deportation', 'asylum', 'naturalization', 'immigrant'],
  'Tax Law': ['tax', 'IRS', 'deduction', 'filing', 'tax return', 'taxation', 'audit', 'tax liability', 'tax law'],
  'Personal Injury': ['injury', 'accident', 'negligence', 'damages', 'compensation', 'liability', 'medical malpractice', 'personal injury']
};

// Legal AI Assistant system prompt
const getSystemPrompt = (primaryTopic = null) => {
  let prompt = `You are a professional legal assistant with expertise in various areas of law. Your role is to provide helpful legal guidance and information to users.

IMPORTANT GUIDELINES:
1. Provide accurate, helpful legal information based on general legal principles
2. Always include appropriate disclaimers about not being legal advice
3. Encourage users to consult with qualified attorneys for specific legal matters
4. Be clear about limitations and when professional legal counsel is needed
5. Use clear, understandable language while maintaining legal accuracy
6. Focus on educational and informational responses
7. If asked about specific legal situations, provide general guidance but emphasize the need for professional consultation`;

  if (primaryTopic) {
    prompt += `\n\nTOPIC FOCUS:
This conversation session is focused on: ${primaryTopic}
- Keep responses relevant to ${primaryTopic} and related legal matters
- If the user asks about a completely different legal topic, politely acknowledge the topic change and suggest they either:
  1. Continue with the current topic (${primaryTopic}) for better context and continuity
  2. Start a new session for the different topic to maintain organized conversation threads
- Be helpful but guide users to maintain topic coherence within a session`;
  }

  prompt += `\n\nAREAS OF EXPERTISE:
- Contract Law
- Employment Law
- Real Estate Law
- Business Law
- Family Law
- Criminal Law
- Intellectual Property
- Immigration Law
- Tax Law
- Personal Injury Law

DISCLAIMER: Always include this disclaimer in your responses:
"This information is for educational purposes only and should not be considered legal advice. For specific legal matters, please consult with a qualified attorney in your jurisdiction."

Format your responses professionally and clearly.`;

  return prompt;
};

// Detect primary topic from message
function detectTopic(message) {
  const lowerMessage = message.toLowerCase();
  let maxMatches = 0;
  let detectedTopic = null;

  for (const [topic, keywords] of Object.entries(LEGAL_TOPICS)) {
    let matches = 0;
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedTopic = topic;
    }
  }

  return detectedTopic;
}

// Check if a message is off-topic compared to the session's primary topic
function isOffTopic(message, primaryTopic) {
  if (!primaryTopic) return false; // No topic set, can't be off-topic
  
  const detectedTopic = detectTopic(message);
  
  // If no topic detected, it might be a general question - not necessarily off-topic
  if (!detectedTopic) return false;
  
  // If detected topic matches primary topic, it's on-topic
  if (detectedTopic === primaryTopic) return false;
  
  // Check if topics are related (e.g., Business Law and Tax Law might be related)
  const relatedTopics = {
    'Business Law': ['Tax Law', 'Contract Law'],
    'Tax Law': ['Business Law'],
    'Contract Law': ['Business Law', 'Real Estate'],
    'Real Estate': ['Contract Law'],
    'Family Law': ['Personal Injury'],
    'Employment Law': ['Business Law']
  };
  
  const related = relatedTopics[primaryTopic] || [];
  if (related.includes(detectedTopic)) {
    return false; // Related topics are considered on-topic
  }
  
  // Different topic detected - likely off-topic
  return true;
};

// Generate AI response using OpenRouter
async function generateAIResponse(messages, model = 'tngtech/deepseek-r1t2-chimera:free', primaryTopic = null) {
  try {
    const systemPrompt = getSystemPrompt(primaryTopic);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
        'X-Title': 'advoqat AI Assistant'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages
        ],
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      throw new Error('Failed to generate AI response');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      tokens_used: data.usage?.total_tokens || 0,
      model_used: model
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw new Error('Failed to generate AI response');
  }
}

// POST /api/v1/ai/chat - Send a message and get AI response
export const sendMessage = async (req, res) => {
  try {
    const { sessionId, message, userId, topic } = req.body;
    
    console.log('sendMessage called with:', { sessionId, userId, messageLength: message?.length, topic });
    
    // Validate required fields
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' });
    }

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
    
    const user = [{ id: userCheck[0].id }];

    let session;
    let primaryTopic = null;
    let isOffTopicQuestion = false;
    
    // If sessionId is provided, use existing session, otherwise create new one
    if (sessionId) {
      const sessionResult = await sql`
        SELECT id, title, primary_topic FROM chat_sessions 
        WHERE id = ${sessionId} AND user_id = ${user[0].id} AND status = 'active'
      `;
      
      if (sessionResult.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      session = sessionResult[0];
      primaryTopic = session.primary_topic;
      
      // Check if the new message is off-topic
      if (primaryTopic) {
        isOffTopicQuestion = isOffTopic(message, primaryTopic);
        console.log('Topic check:', { primaryTopic, isOffTopicQuestion });
      }
    } else {
      // Create new session with title from first message
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      
      // Detect topic from the first message or use provided topic
      const detectedTopic = topic || detectTopic(message);
      
      const [newSession] = await sql`
        INSERT INTO chat_sessions (user_id, title, category, primary_topic)
        VALUES (${user[0].id}, ${title}, 'Legal Consultation', ${detectedTopic || null})
        RETURNING id, title, primary_topic
      `;
      session = newSession;
      primaryTopic = newSession.primary_topic;
    }

    // Save user message
    await sql`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (${session.id}, 'user', ${message})
    `;

    // Get conversation history for context
    const history = await sql`
      SELECT role, content FROM chat_messages 
      WHERE session_id = ${session.id}
      ORDER BY created_at ASC
    `;

    // Prepare messages for AI
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // If off-topic, add a special instruction to the last user message
    if (isOffTopicQuestion && primaryTopic) {
      const lastMessageIndex = messages.length - 1;
      if (lastMessageIndex >= 0 && messages[lastMessageIndex].role === 'user') {
        messages[lastMessageIndex].content = `${message}\n\n[Note: This question appears to be about a different legal topic than the current session focus (${primaryTopic}). Please acknowledge this and suggest the user either continue with ${primaryTopic} or start a new session for the different topic.]`;
      }
    }

    // Generate AI response with topic awareness
    const aiResponse = await generateAIResponse(messages, 'tngtech/deepseek-r1t2-chimera:free', primaryTopic);

    // Save AI response
    await sql`
      INSERT INTO chat_messages (session_id, role, content, tokens_used, model_used)
      VALUES (${session.id}, 'assistant', ${aiResponse.content}, ${aiResponse.tokens_used}, ${aiResponse.model_used})
    `;

    // Update primary topic if it wasn't set and we detected one
    if (!primaryTopic && sessionId) {
      const detectedTopic = detectTopic(message);
      if (detectedTopic) {
        await sql`
          UPDATE chat_sessions 
          SET primary_topic = ${detectedTopic}
          WHERE id = ${session.id}
        `;
        primaryTopic = detectedTopic;
      }
    }

    res.json({
      success: true,
      sessionId: session.id,
      sessionTitle: session.title,
      response: aiResponse.content,
      tokensUsed: aiResponse.tokens_used,
      modelUsed: aiResponse.model_used,
      isOffTopic: isOffTopicQuestion,
      primaryTopic: primaryTopic
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

// GET /api/v1/ai/sessions - Get user's chat sessions
export const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log('Fetching sessions for userId:', userId);
    
    // Handle both numeric ID and UUID (supabase_id)
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
      // It's a numeric ID
      console.log('Checking for numeric user ID:', userIdString);
      const numericId = parseInt(userIdString, 10);
      if (!isNaN(numericId) && numericId > 0 && userIdString === String(numericId)) {
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
    
    const sessions = await sql`
      SELECT 
        cs.id,
        cs.title,
        cs.category,
        cs.status,
        cs.created_at,
        cs.updated_at,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_message_at
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.id = cm.session_id
      WHERE cs.user_id = ${numericUserId} AND cs.status != 'deleted'
      GROUP BY cs.id, cs.title, cs.category, cs.status, cs.created_at, cs.updated_at
      ORDER BY cs.updated_at DESC
    `;
    
    console.log('Found sessions:', sessions.length);
    
    res.json({
      success: true,
      sessions: sessions
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

// GET /api/v1/ai/sessions/:id - Get specific session with messages
export const getSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
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
    
    const user = [{ id: userCheck[0].id }];
    
    // Get session details
    const sessions = await sql`
      SELECT id, title, category, status, created_at, updated_at
      FROM chat_sessions 
      WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
    `;
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get messages for this session
    const messages = await sql`
      SELECT id, role, content, tokens_used, model_used, created_at
      FROM chat_messages 
      WHERE session_id = ${id}
      ORDER BY created_at ASC
    `;
    
    res.json({
      success: true,
      session: sessions[0],
      messages: messages
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

// DELETE /api/v1/ai/sessions/:id - Delete session (soft delete)
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
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
    
    const user = [{ id: userCheck[0].id }];
    
    const result = await sql`
      UPDATE chat_sessions 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user[0].id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
};

// PUT /api/v1/ai/sessions/:id - Update session title
export const updateSessionTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, title } = req.body;
    
    if (!userId || !title) {
      return res.status(400).json({ error: 'User ID and title are required' });
    }
    
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
    
    const user = [{ id: userCheck[0].id }];
    
    const result = await sql`
      UPDATE chat_sessions 
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user[0].id} AND status != 'deleted'
      RETURNING id, title
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      success: true,
      session: result[0]
    });
  } catch (error) {
    console.error('Error updating session title:', error);
    res.status(500).json({ error: 'Failed to update session title' });
  }
};

// GET /api/v1/ai/models - Get available AI models
export const getAvailableModels = async (req, res) => {
  try {
    const models = [
      {
        id: 'tngtech/deepseek-r1t2-chimera:free',
        name: 'DeepSeek R1T2 Chimera (Free)',
        description: 'High-performance model with reasoning capabilities - faster and more efficient',
        maxTokens: 4000,
        pricing: 'Free'
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Advanced reasoning and analysis',
        maxTokens: 4000,
        pricing: 'Paid'
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        description: 'Latest OpenAI model with enhanced capabilities',
        maxTokens: 4000,
        pricing: 'Paid'
      }
    ];
    
    res.json({
      success: true,
      models: models
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
};

// POST /api/v1/ai/chat/stream - Stream chat response (for real-time updates)
export const streamChat = async (req, res) => {
  try {
    const { sessionId, message, userId, model = 'tngtech/deepseek-r1t2-chimera:free' } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' });
    }

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
    
    const user = [{ id: userCheck[0].id }];

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // For now, return a simple response (full streaming implementation would require more complex setup)
    const aiResponse = await generateAIResponse([
      { role: 'user', content: message }
    ], model);

    res.write(`data: ${JSON.stringify({
      type: 'response',
      content: aiResponse.content,
      tokensUsed: aiResponse.tokens_used,
      modelUsed: aiResponse.model_used
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error('Error in streamChat:', error);
    res.status(500).json({ error: 'Failed to stream chat' });
  }
};

// POST /api/v1/ai/upload-documents - Upload documents for AI processing
export const uploadDocuments = async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

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
    
    const user = [{ id: userCheck[0].id }];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedDocuments = [];

    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname} (${file.mimetype})`);
        
        // Extract text from the document
        const extractedText = await extractTextFromDocument(file.path, file.mimetype);
        
        console.log(`Extracted ${extractedText.length} characters from ${file.originalname}`);
        
        // Save document to database
        const documentId = await saveUploadedDocument(
          user[0].id,
          file.filename,
          file.originalname,
          file.path,
          extractedText,
          sessionId
        );

        uploadedDocuments.push({
          id: documentId,
          originalName: file.originalname,
          fileName: file.filename,
          extractedText: extractedText.substring(0, 200) + '...' // Truncate for response
        });
        
        console.log(`Successfully processed: ${file.originalname}`);
      } catch (error) {
        console.error('Error processing file:', file.originalname, error);
        // Continue with other files even if one fails
      }
    }

    res.json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      documents: uploadedDocuments
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
};

// GET /api/v1/ai/documents/:sessionId - Get documents for a session
export const getSessionDocumentsController = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

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
    
    const user = [{ id: userCheck[0].id }];

    const documents = await getSessionDocuments(sessionId);

    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('Error getting session documents:', error);
    res.status(500).json({ error: 'Failed to get session documents' });
  }
};

// DELETE /api/v1/ai/documents/:documentId - Delete a document
export const deleteDocumentController = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

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
    
    const user = [{ id: userCheck[0].id }];

    const deleted = await deleteDocument(documentId, user[0].id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
}; 