# Backend Authentication Setup

## Environment Variables Required

Add these to your backend `.env` file:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:5001
NEXTAUTH_SECRET=your_nextauth_secret_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5001/api/auth/callback/google` (for development)
   - `https://yourdomain.com/api/auth/callback/google` (for production)
7. Copy the Client ID and Client Secret to your environment variables

## Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## Backend Authentication Endpoints

The backend now provides these authentication endpoints:

- `GET /api/auth/session` - Get current user session
- `POST /api/auth/signout` - Sign out user
- `GET /api/auth/providers` - Get available auth providers
- `GET /api/auth/csrf` - Get CSRF token
- `POST /api/auth/signin/google` - Sign in with Google
- `GET /api/auth/callback/google` - Google OAuth callback

## How It Works

1. **Authentication Flow**: NextAuth.js handles all OAuth flows in the backend
2. **Database Sync**: User data is automatically synced to your database during authentication
3. **Session Management**: Sessions are managed server-side with JWT tokens
4. **Frontend Integration**: Frontend makes API calls to backend for authentication

## Testing

1. Start the backend server: `npm start`
2. The backend will be available at `http://localhost:5001`
3. Authentication endpoints will be available at `http://localhost:5001/api/auth/*`
4. Test Google OAuth by visiting: `http://localhost:5001/api/auth/signin/google`

