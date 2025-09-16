import express from 'express';
import { 
    getNotifications, 
    getUnreadNotificationCount, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    deleteNotification,
    createNotificationEndpoint
} from '../controllers/notificationController.js';

const router = express.Router();

// Create a new notification
router.post('/', createNotificationEndpoint);

// Get all notifications for a user
router.get('/:userId', getNotifications);

// Get unread notification count for a user
router.get('/:userId/unread-count', getUnreadNotificationCount);

// Mark a specific notification as read
router.patch('/:notificationId/read', markNotificationAsRead);

// Mark all notifications as read for a user
router.patch('/:userId/read-all', markAllNotificationsAsRead);

// Delete a notification
router.delete('/:notificationId', deleteNotification);

export default router;
