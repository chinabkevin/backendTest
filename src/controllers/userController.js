import { sql } from "../config/db.js";

export async function syncUser(req, res) {
    const { supabaseId, email, name } = req.body;
    console.log('[syncUser] Incoming:', { supabaseId, email, name });
    
    if (!supabaseId || !email) {
        console.log('[syncUser] Missing supabaseId or email');
        return res.status(400).json({ error: 'Missing supabaseId or email' });
    }
    try {
        // Try to update, if not found then insert
        let user = await sql`
            UPDATE "user" SET email = ${email}, name = ${name}, updated_at = NOW()
            WHERE supabase_id = ${supabaseId}
            RETURNING id, supabase_id, email, name, role, created_at, updated_at`;
        console.log('[syncUser] Update result:', user);
        if (user.length === 0) {
            user = await sql`
                INSERT INTO "user" (supabase_id, email, name)
                VALUES (${supabaseId}, ${email}, ${name})
                RETURNING id, supabase_id, email, name, role, created_at, updated_at`;
            console.log('[syncUser] Insert result:', user);
        }
        console.log('[syncUser] User synced:', user[0]);

        res.status(200).json(user[0]);
    } catch (error) {
        console.error('[syncUser] Error syncing user:', error);
        if (error.code === '23505' && error.detail && error.detail.includes('email')) {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }
        res.status(500).json({ error: 'Failed to sync user' });
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
        // Get user ID from supabase_id
        const user = await sql`
            SELECT id FROM "user" WHERE supabase_id = ${userId}
        `;
        
        if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update user profile
        const result = await sql`
            UPDATE "user" 
            SET 
                name = ${name || null},
                phone = ${phone || null},
                address = ${address || null},
                updated_at = NOW()
            WHERE id = ${user[0].id}
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