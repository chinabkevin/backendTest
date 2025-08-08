import { sql } from '../config/db.js';

export async function userExists(req, res, next) {
    // Check for userId in various places
    const userId = req.body.userId || req.body.clientId || req.params.userId || req.params.clientId;
    
    console.log('userExists middleware - checking for userId:', userId);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request params:', req.params);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Full request body:', req.body);
    
    try {
        if (!userId) {
            console.log('No userId found in request');
            console.log('Available body keys:', Object.keys(req.body));
            console.log('Body values:', req.body);
            return res.status(400).json({ error: 'Missing userId' });
        }

        let user;
        
        // Check if userId is a UUID (Supabase ID) or integer (local DB ID)
        if (userId.includes('-')) {
            console.log('Checking for UUID user:', userId);
            // UUID format - check supabase_id
            user = await sql`SELECT * FROM "user" WHERE supabase_id = ${userId}`;
        } else {
            console.log('Checking for integer user:', userId);
            // Integer format - check id
            user = await sql`SELECT * FROM "user" WHERE id = ${parseInt(userId)}`;
        }

        console.log('User query result:', user);

        if (!user.length) {
            console.log('User not found in database');
            return res.status(404).json({ error: 'User not found in database. Please ensure you are properly registered.' });
        }
        
        req.user = user[0];
        console.log('User found and set in request:', req.user.id);
        next();
    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({ error: 'Failed to check user existence' });
    }
} 