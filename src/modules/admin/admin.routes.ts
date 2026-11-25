import { Router } from 'express';
import multer from 'multer';
import { AdminController } from './admin.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireAdmin, requireSuperAdmin } from '../../common/middleware/authorize.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authLimiter } from '../../common/middleware/rateLimiter.js';
import {
  adminLoginSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  rejectPropertySchema,
  updatePropertyStatusSchema,
  updateInquiryStatusSchema,
  updateAdminProfileSchema,
  changeAdminPasswordSchema,
} from './admin.validation.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatar'));
    }
  },
});

// ==========================================
// 1. Unauthenticated Admin Auth Routes (Rate Limited)
// ==========================================
router.post('/auth/login', authLimiter, validateRequest(adminLoginSchema), asyncHandler(AdminController.login));
router.post('/auth/refresh', asyncHandler(AdminController.refresh));
router.post('/auth/logout', asyncHandler(AdminController.logout));

// ==========================================
// 2. Protected Admin Middleware Guard
// Every endpoint below strictly requires JWT authentication AND ADMIN or SUPER_ADMIN role
// ==========================================
router.use(authenticate, requireAdmin);

// Admin Profile & Settings
router.get('/auth/me', asyncHandler(AdminController.getMe));
router.get('/profile', asyncHandler(AdminController.getProfile));
router.patch('/profile', validateRequest(updateAdminProfileSchema), asyncHandler(AdminController.updateProfile));
router.patch('/profile/avatar', upload.single('avatar'), asyncHandler(AdminController.uploadAvatar));
router.patch('/change-password', validateRequest(changeAdminPasswordSchema), asyncHandler(AdminController.changePassword));

// Dashboard & Analytics
router.get('/dashboard', asyncHandler(AdminController.getDashboard));
router.get('/dashboard/stats', asyncHandler(AdminController.getDashboardStats));
router.get('/dashboard/recent-activity', asyncHandler(AdminController.getRecentActivity));
router.get('/analytics', asyncHandler(AdminController.getAnalytics));

// Reports & Categories
router.get('/reports/users', asyncHandler(AdminController.getUserReports));
router.get('/reports/properties', asyncHandler(AdminController.getPropertyReports));
router.get('/reports/inquiries', asyncHandler(AdminController.getInquiryReports));
router.get('/categories', asyncHandler(AdminController.getCategoryStats));
router.post('/categories', asyncHandler(AdminController.createCategory));
router.patch('/categories/:id', asyncHandler(AdminController.updateCategory));
router.delete('/categories/:id', asyncHandler(AdminController.deleteCategory));

// Audit Logs
router.get('/audit-logs', asyncHandler(AdminController.getAuditLogs));
router.get('/audit-logs/:id', asyncHandler(AdminController.getAuditLogById));

// User Management
router.get('/users', asyncHandler(AdminController.listUsers));
router.get('/users/:id', asyncHandler(AdminController.getUserById));
router.patch('/users/:id/status', validateRequest(updateUserStatusSchema), asyncHandler(AdminController.updateUserStatus));
router.patch('/users/:id/role', requireSuperAdmin, validateRequest(updateUserRoleSchema), asyncHandler(AdminController.updateUserRole));

// Property Management & Moderation
router.get('/properties', asyncHandler(AdminController.listProperties));
router.post('/properties', asyncHandler(AdminController.createProperty));
router.get('/properties/pending', asyncHandler(AdminController.listPendingProperties));
router.get('/properties/:id', asyncHandler(AdminController.getPropertyById));
router.patch('/properties/:id', asyncHandler(AdminController.updateProperty));
router.patch('/properties/:id/approve', asyncHandler(AdminController.approveProperty));
router.patch('/properties/:id/reject', validateRequest(rejectPropertySchema), asyncHandler(AdminController.rejectProperty));
router.patch('/properties/:id/status', validateRequest(updatePropertyStatusSchema), asyncHandler(AdminController.updatePropertyStatus));
router.delete('/properties/:id', asyncHandler(AdminController.deleteProperty));
router.get('/properties/:id/moderation-history', asyncHandler(AdminController.getModerationHistory));

// Inquiry Management
router.get('/inquiries', asyncHandler(AdminController.listInquiries));
router.get('/inquiries/:id', asyncHandler(AdminController.getInquiryById));
router.patch('/inquiries/:id/status', validateRequest(updateInquiryStatusSchema), asyncHandler(AdminController.updateInquiryStatus));

export const adminRoutes = router;
