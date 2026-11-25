import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(NotificationController.listNotifications));
router.patch('/:id/read', asyncHandler(NotificationController.markAsRead));
router.patch('/read-all', asyncHandler(NotificationController.markAllAsRead));

export const notificationRoutes = router;

