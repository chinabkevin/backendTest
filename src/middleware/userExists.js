import { sql } from '../config/db.js';

export async function userExists(req, res, next) {
    // Only require userId (local DB id)
    const userId = req.body.userId || req.body.clientId || req.params.userId || req.params.clientId;
    try {
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        const user = await sql`SELECT * FROM "user" WHERE id = ${userId}`;
        if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        req.user = user[0];
        next();
    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({ error: 'Failed to check user existence' });
    }
} 