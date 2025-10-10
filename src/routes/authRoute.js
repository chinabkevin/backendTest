import express from 'express'
import { googleOAuthConfig, syncUserToDatabase } from '../config/auth.js'
import { sql } from '../config/db.js'

const router = express.Router()

// Google OAuth signin endpoint
router.get('/api/auth/signin/google', (req, res) => {
  const authUrl = new URL(googleOAuthConfig.authorizationUrl)
  authUrl.searchParams.set('client_id', googleOAuthConfig.clientId)
  authUrl.searchParams.set('redirect_uri', googleOAuthConfig.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', googleOAuthConfig.scope)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'select_account')
  authUrl.searchParams.set('state', 'random_state_string') // Add state parameter for security
  
  console.log('Redirecting to Google OAuth:', authUrl.toString())
  res.redirect(authUrl.toString())
})

// Google OAuth callback endpoint
router.get('/api/auth/callback/google', async (req, res) => {
  try {
    const { code } = req.query
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' })
    }

    // Exchange code for access token
    const tokenResponse = await fetch(googleOAuthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: googleOAuthConfig.clientId,
        client_secret: googleOAuthConfig.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: googleOAuthConfig.redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token')
    }

    // Get user info from Google
    const userResponse = await fetch(googleOAuthConfig.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()
    
    // Sync user to database
    const syncedUser = await syncUserToDatabase(userData)
    
    if (syncedUser) {
      // Create session (you can use JWT or session store)
      const sessionData = {
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          image: userData.picture,
          role: syncedUser.role,
          backendId: syncedUser.id
        }
      }
      
      // Create a simple token for cross-domain authentication
      const token = Buffer.from(JSON.stringify(sessionData)).toString('base64')
      
      console.log('[OAuth] Session data:', sessionData)
      console.log('[OAuth] Generated token:', token)
      console.log('[OAuth] Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:3000')
      
      // Redirect to frontend dashboard with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?token=${encodeURIComponent(token)}`
      console.log('[OAuth] Redirecting to:', redirectUrl)
      
      res.redirect(redirectUrl)
    } else {
      throw new Error('Failed to sync user to database')
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error`)
  }
})

// Get current session
router.get('/api/auth/session', async (req, res) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization
    let sessionData = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        sessionData = JSON.parse(decoded)
      } catch (tokenError) {
        console.error('Error decoding token:', tokenError)
      }
    }
    
    // Fallback to cookie for backward compatibility
    if (!sessionData) {
      const sessionCookie = req.cookies.auth_session
      if (sessionCookie) {
        sessionData = JSON.parse(sessionCookie)
      }
    }
    
    if (sessionData && sessionData.user) {
      res.json({
        success: true,
        user: sessionData.user
      })
    } else {
      res.json({
        success: false,
        user: null
      })
    }
  } catch (error) {
    console.error('Error getting session:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    })
  }
})

// Email/password signup endpoint
router.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body
    
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and name are required' 
      })
    }
    
    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM "user" WHERE email = ${email}
    `
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this email already exists' 
      })
    }
    
    // Create new user (for demo, we'll use email as supabase_id)
    // In production, you should use proper password hashing
    const newUser = await sql`
      INSERT INTO "user" (supabase_id, email, name, phone)
      VALUES (${email}, ${email}, ${name}, ${phone || null})
      RETURNING id, supabase_id, email, name, role, created_at, updated_at
    `
    
    console.log('[Auth] New user created:', newUser[0])
    
    // Create session data
    const sessionData = {
      user: {
        id: newUser[0].supabase_id,
        name: newUser[0].name,
        email: newUser[0].email,
        image: null,
        role: newUser[0].role,
        backendId: newUser[0].id
      }
    }
    
    // Create token for cross-domain authentication
    const token = Buffer.from(JSON.stringify(sessionData)).toString('base64')
    
    res.json({
      success: true,
      token: token,
      user: sessionData.user
    })
    
  } catch (error) {
    console.error('Email/password signup error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Email/password signin endpoint
router.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      })
    }
    
    // For now, we'll create a simple user lookup and password check
    // In a real app, you'd use proper password hashing (bcrypt, etc.)
    const users = await sql`
      SELECT id, supabase_id, email, name, role, created_at, updated_at 
      FROM "user" 
      WHERE email = ${email}
    `
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      })
    }
    
    const user = users[0]
    
    // For demo purposes, we'll accept any password for existing users
    // In production, you should store hashed passwords and verify them
    console.log('[Auth] Email/password signin successful for:', email)
    
    // Create session data
    const sessionData = {
      user: {
        id: user.supabase_id,
        name: user.name,
        email: user.email,
        image: null,
        role: user.role,
        backendId: user.id
      }
    }
    
    // Create token for cross-domain authentication
    const token = Buffer.from(JSON.stringify(sessionData)).toString('base64')
    
    res.json({
      success: true,
      token: token,
      user: sessionData.user
    })
    
  } catch (error) {
    console.error('Email/password signin error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

router.post('/api/auth/signout', async (req, res) => {
  try {
    // Clear the session cookie
    res.clearCookie('auth_session')
    res.json({
      success: true,
      message: 'Signed out successfully'
    })
  } catch (error) {
    console.error('Error signing out:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to sign out'
    })
  }
})

// Get available auth providers
router.get('/api/auth/providers', async (req, res) => {
  try {
    res.json({
      google: {
        id: 'google',
        name: 'Google',
        type: 'oauth',
        signinUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:5001'}/api/auth/signin/google`,
        callbackUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:5001'}/api/auth/callback/google`
      }
    })
  } catch (error) {
    console.error('Error getting providers:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get providers'
    })
  }
})

// Get CSRF token
router.get('/api/auth/csrf', async (req, res) => {
  try {
    // Generate a simple CSRF token (in production, use a proper CSRF library)
    const csrfToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    res.json({
      csrfToken
    })
  } catch (error) {
    console.error('Error getting CSRF token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get CSRF token'
    })
  }
})

export default router
