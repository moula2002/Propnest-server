import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { userRoutes } from '../modules/users/user.routes.js';
import { propertyRoutes } from '../modules/properties/property.routes.js';
import { categoryRoutes } from '../modules/categories/category.routes.js';
import { amenityRoutes } from '../modules/amenities/amenity.routes.js';
import { favoriteRoutes } from '../modules/favorites/favorite.routes.js';
import { inquiryRoutes } from '../modules/inquiries/inquiry.routes.js';
import { locationRoutes } from '../modules/locations/location.routes.js';
import { notificationRoutes } from '../modules/notifications/notification.routes.js';
import { adminRoutes } from '../modules/admin/admin.routes.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { uploadRoutes } from '../modules/upload/upload.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/properties', propertyRoutes);
router.use('/categories', categoryRoutes);
router.use('/amenities', amenityRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/locations', locationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/upload', uploadRoutes);
router.use('/health', healthRoutes);

export const apiV1Routes = router;

