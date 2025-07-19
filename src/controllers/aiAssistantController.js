import { sql } from '../config/db.js';

// Legal AI Assistant system prompt
const LEGAL_SYSTEM_PROMPT = `You are a professional legal assistant with expertise in various areas of law. Your role is to provide helpful legal guidance and information to users.

IMPORTANT GUIDELINES:
1. Provide accurate, helpful legal information based on general legal principles
2. Always include appropriate disclaimers about not being legal advice
3. Encourage users to consult with qualified attorneys for specific legal matters
4. Be clear about limitations and when professional legal counsel is needed
5. Use clear, understandable language while maintaining legal accuracy
6. Focus on educational and informational responses
7. If asked about specific legal situations, provide general guidance but emphasize the need for professional consultation

AREAS OF EXPERTISE:
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

// Generate AI response using OpenRouter
async function generateAIResponse(messages, model = 'deepseek/deepseek-r1:free') {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
        'X-Title': 'LegaliQ AI Assistant'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: LEGAL_SYSTEM_PROMPT
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
    const { sessionId, message, userId } = req.body;
    
    console.log('sendMessage called with:', { sessionId, userId, messageLength: message?.length });
    
    // Validate required fields
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let session;
    
    // If sessionId is provided, use existing session, otherwise create new one
    if (sessionId) {
      session = await sql`
        SELECT id, title FROM chat_sessions 
        WHERE id = ${sessionId} AND user_id = ${user[0].id} AND status = 'active'
      `;
      
      if (session.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      session = session[0];
    } else {
      // Create new session with title from first message
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const [newSession] = await sql`
        INSERT INTO chat_sessions (user_id, title, category)
        VALUES (${user[0].id}, ${title}, 'Legal Consultation')
        RETURNING id, title
      `;
      session = newSession;
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

    // Generate AI response
    const aiResponse = await generateAIResponse(messages);

    // Save AI response
    await sql`
      INSERT INTO chat_messages (session_id, role, content, tokens_used, model_used)
      VALUES (${session.id}, 'assistant', ${aiResponse.content}, ${aiResponse.tokens_used}, ${aiResponse.model_used})
    `;

    res.json({
      success: true,
      sessionId: session.id,
      sessionTitle: session.title,
      response: aiResponse.content,
      tokensUsed: aiResponse.tokens_used,
      modelUsed: aiResponse.model_used
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
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
      WHERE cs.user_id = ${user[0].id} AND cs.status != 'deleted'
      GROUP BY cs.id, cs.title, cs.category, cs.status, cs.created_at, cs.updated_at
      ORDER BY cs.updated_at DESC
    `;
    
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
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1 (Free)',
        description: 'High-performance model with reasoning capabilities',
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
    const { sessionId, message, userId, model = 'deepseek/deepseek-r1:free' } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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