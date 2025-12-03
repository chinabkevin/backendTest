import { sql } from "../config/db.js";

export async function syncUser(req, res) {
    const { email, name, phone } = req.body;
    console.log('[syncUser] Incoming request:', { email, name, phone });
    
    if (!email) {
        console.log('[syncUser] Missing email');
        return res.status(400).json({ error: 'Missing email' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.log('[syncUser] Invalid email format:', email);
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    try {
        const existingUsers = await sql`
            SELECT id, supabase_id, email, name, role, created_at, updated_at 
            FROM "user" 
            WHERE LOWER(email) = LOWER(${email})
        `;
        
        let result;
        if (existingUsers.length > 0) {
            const existing = existingUsers[0];
            result = await sql`
                UPDATE "user"
                SET 
                    name = COALESCE(${name}, name),
                    phone = COALESCE(${phone}, phone),
                    updated_at = NOW()
                WHERE id = ${existing.id}
                RETURNING id, supabase_id, email, name, role, created_at, updated_at
            `;
            console.log('[syncUser] Updated user by email:', result[0]);
        } else {
            result = await sql`
                INSERT INTO "user" (email, name, phone)
                VALUES (${email}, ${name || null}, ${phone || null})
                RETURNING id, supabase_id, email, name, role, created_at, updated_at
            `;
            console.log('[syncUser] Created new user:', result[0]);
        }
        
        if (!result.length) {
            console.error('[syncUser] No user returned after sync operation');
            return res.status(500).json({ error: 'Failed to sync user' });
        }
        
        const syncedUser = result[0];
        console.log('[syncUser] ✅ User synced successfully:', {
            id: syncedUser.id,
            email: syncedUser.email,
            role: syncedUser.role
        });
        res.status(200).json(syncedUser);
        
    } catch (error) {
        console.error('[syncUser] Error syncing user:', error);
        if (error.code === '23505' && error.detail?.includes('email')) {
            return res.status(409).json({ 
                error: 'A user with this email already exists.',
                code: 'EMAIL_EXISTS'
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to sync user to database',
            code: 'SYNC_FAILED',
            details: error.message
        });
    }
}

export async function getUserRole(req, res) {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
        const user = await sql`SELECT role FROM "user" WHERE id = ${userId}`;
        if (!user.length) return res.status(404).json({ error: 'User not found' });
        res.json({ role: user[0].role });
    } catch (error) {
        console.error('Error fetching user role:', error);
        res.status(500).json({ error: 'Failed to fetch user role' });
    }
}

export async function getUserBySupabaseId(req, res) {
    const supabaseId = req.query.supabaseId || req.params.supabaseId;
    if (!supabaseId) return res.status(400).json({ error: 'Missing supabaseId' });
    try {
        const user = await sql`SELECT id, email, name, role FROM "user" WHERE supabase_id = ${supabaseId}`;
        if (!user.length) return res.status(404).json({ error: 'User not found' });
        res.json(user[0]);
    } catch (error) {
        console.error('Error fetching user by supabase ID:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}

// GET /api/users/profile - Get user profile
export async function getUserProfile(req, res) {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    try {
        // Get user ID from supabase_id
        const user = await sql`
            SELECT id, email, name, phone, address, profile_image_url, created_at, updated_at
            FROM "user" 
            WHERE supabase_id = ${userId}
        `;
        
        if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            success: true,
            profile: user[0]
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
}

// PUT /api/users/update - Update user profile
export async function updateUserProfile(req, res) {
    const { userId, name, phone, address } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    try {
        let dbUserId;
        
        // Convert userId to string for checking format
        const userIdString = String(userId);
        
        // Check if userId is a UUID (Supabase ID) or integer (local DB ID)
        if (userIdString.includes('-')) {
            // UUID format - check supabase_id
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            
            if (!user.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            dbUserId = user[0].id;
        } else {
            // Integer format - use directly
            dbUserId = parseInt(userIdString);
            
            // Verify user exists
            const user = await sql`
                SELECT id FROM "user" WHERE id = ${dbUserId}
            `;
            
            if (!user.length) {
                return res.status(404).json({ error: 'User not found' });
            }
        }
        
        // Update user profile
        const result = await sql`
            UPDATE "user" 
            SET 
                name = COALESCE(${name || null}, name),
                phone = COALESCE(${phone || null}, phone),
                address = COALESCE(${address || null}, address),
                updated_at = NOW()
            WHERE id = ${dbUserId}
            RETURNING id, email, name, phone, address, profile_image_url, created_at, updated_at
        `;
        
        res.json({
            success: true,
            profile: result[0]
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
} 

export async function ensureUserExists(req, res) {
    const { supabaseId, email, name } = req.body;
    
    try {
        if (!supabaseId || !email) {
            return res.status(400).json({ error: 'Missing required fields: supabaseId, email' });
        }

        // Check if user already exists
        let user = await sql`SELECT * FROM "user" WHERE supabase_id = ${supabaseId}`;
        
        if (user.length === 0) {
            // Create new user
            user = await sql`
                INSERT INTO "user" (supabase_id, email, name, created_at, updated_at)
                VALUES (${supabaseId}, ${email}, ${name || null}, NOW(), NOW())
                RETURNING *
            `;
            console.log('Created new user:', user[0]);
        } else {
            console.log('User already exists:', user[0]);
        }

        res.json({
            success: true,
            user: user[0]
        });
    } catch (error) {
        console.error('Error ensuring user exists:', error);
        res.status(500).json({ error: 'Failed to ensure user exists' });
    }
}

export async function getUserById(req, res) {
    const { userId } = req.params;
    
    try {
        let user;
        
        if (userId.includes('-')) {
            // UUID format
            user = await sql`SELECT * FROM "user" WHERE supabase_id = ${userId}`;
        } else {
            // Integer format
            user = await sql`SELECT * FROM "user" WHERE id = ${parseInt(userId)}`;
        }

        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user[0]);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
} 