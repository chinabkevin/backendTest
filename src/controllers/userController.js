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
            RETURNING *`;
        console.log('[syncUser] Update result:', user);
        if (user.length === 0) {
            user = await sql`
                INSERT INTO "user" (supabase_id, email, name)
                VALUES (${supabaseId}, ${email}, ${name})
                RETURNING *`;
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