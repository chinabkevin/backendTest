import express from 'express'
import { googleOAuthConfig, syncUserToDatabase } from '../config/auth.js'

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
      
      // Set session cookie (you might want to use a proper session store)
      res.cookie('auth_session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      
      // Redirect to frontend dashboard
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`)
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
    const sessionCookie = req.cookies.auth_session
    
    if (sessionCookie) {
      const sessionData = JSON.parse(sessionCookie)
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
