import { sql } from './db.js'

// Simple Google OAuth configuration for Express
export const googleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/auth/callback/google`,
  scope: 'openid email profile',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
}

// Function to sync user to database
export async function syncUserToDatabase(userData) {
  try {
    console.log('[Auth] Syncing user to database:', {
      googleId: userData.id,
      email: userData.email,
      name: userData.name
    })
    
    // Check if user exists by supabase_id (now accepts string IDs)
    let dbUser = await sql`
      SELECT id, supabase_id, email, name, role, created_at, updated_at 
      FROM "user" 
      WHERE supabase_id = ${userData.id}`;
    
    if (dbUser.length > 0) {
      // User exists, update their information
      dbUser = await sql`
        UPDATE "user" 
        SET email = ${userData.email}, 
            name = COALESCE(${userData.name}, name), 
            updated_at = NOW()
        WHERE supabase_id = ${userData.id}
        RETURNING id, supabase_id, email, name, role, created_at, updated_at`;
      console.log('[Auth] User updated:', dbUser[0]);
    } else {
      // User doesn't exist, create new user
      dbUser = await sql`
        INSERT INTO "user" (supabase_id, email, name)
        VALUES (${userData.id}, ${userData.email}, ${userData.name || ''})
        RETURNING id, supabase_id, email, name, role, created_at, updated_at`;
      console.log('[Auth] User created:', dbUser[0]);
    }
    
    return dbUser.length > 0 ? dbUser[0] : null
  } catch (error) {
    console.error('[Auth] Error syncing user to database:', error)
    return null
  }
}

