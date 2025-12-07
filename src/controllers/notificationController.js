import { sql } from "../config/db.js";

// Get all notifications for a user
export async function getNotifications(req, res) {
    const { userId } = req.params;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for notifications...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const notifications = await sql`
            SELECT * FROM notifications 
            WHERE user_id = ${dbUserId} 
            ORDER BY created_at DESC 
            LIMIT 50
        `;
        
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
}

// Get unread notification count
export async function getUnreadNotificationCount(req, res) {
    const { userId } = req.params;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
        }
        
        const result = await sql`
            SELECT COUNT(*) as unread_count 
            FROM notifications 
            WHERE user_id = ${dbUserId} AND is_read = false
        `;
        
        res.json({ unread_count: parseInt(result[0].unread_count) });
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        res.status(500).json({ error: 'Failed to fetch unread notification count' });
    }
}

// Mark notification as read
export async function markNotificationAsRead(req, res) {
    const { notificationId } = req.params;
    try {
        if (!notificationId) return res.status(400).json({ error: 'Missing notificationId' });
        
        const updated = await sql`
            UPDATE notifications 
            SET is_read = true, read_at = NOW() 
            WHERE id = ${notificationId} 
            RETURNING *
        `;
        
        if (!updated.length) return res.status(404).json({ error: 'Notification not found' });
        
        res.json(updated[0]);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
}

// Mark all notifications as read for a user
export async function markAllNotificationsAsRead(req, res) {
    const { userId } = req.params;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
        }
        
        const updated = await sql`
            UPDATE notifications 
            SET is_read = true, read_at = NOW() 
            WHERE user_id = ${dbUserId} AND is_read = false 
            RETURNING *
        `;
        
        res.json({ 
            message: 'All notifications marked as read',
            updated_count: updated.length 
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
}

// Create a new notification endpoint
export async function createNotificationEndpoint(req, res) {
    const { userId, type, title, message, data = {} } = req.body;
    try {
        if (!userId || !type || !title || !message) {
            return res.status(400).json({ error: 'Missing required fields: userId, type, title, message' });
        }
        
        const notification = await createNotification(userId, type, title, message, data);
        if (!notification) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(201).json(notification);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
}

// Create a new notification (utility function for other controllers)
export async function createNotification(userId, type, title, message, data = {}) {
    try {
        // Handle email addresses, UUIDs, and numeric database IDs
        let dbUserId = userId;
        
        // Check if it's an email address
        if (userId && userId.includes('@')) {
            const user = await sql`
                SELECT id FROM "user" WHERE email = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for email:', userId);
                return null;
            }
            dbUserId = user[0].id;
        } else if (userId && userId.includes('-')) { // This is a Supabase UUID
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return null;
            }
            dbUserId = user[0].id;
        } else {
            // Assume it's a numeric ID, but validate it
            const numericId = parseInt(userId);
            if (isNaN(numericId)) {
                console.log('Invalid user ID format:', userId);
                return null;
            }
            dbUserId = numericId;
        }
        
        const notification = await sql`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (${dbUserId}, ${type}, ${title}, ${message}, ${JSON.stringify(data)})
            RETURNING *
        `;
        
        return notification[0];
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

// Delete a notification
export async function deleteNotification(req, res) {
    const { notificationId } = req.params;
    try {
        if (!notificationId) return res.status(400).json({ error: 'Missing notificationId' });
        
        const deleted = await sql`
            DELETE FROM notifications 
            WHERE id = ${notificationId} 
            RETURNING *
        `;
        
        if (!deleted.length) return res.status(404).json({ error: 'Notification not found' });
        
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
}
