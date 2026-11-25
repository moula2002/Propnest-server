import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { AdminService } from '../admin/admin.service.js';

const router = Router();

// Public endpoint: returns active admin-managed property categories with live property counts
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const stats = await AdminService.getCategoryStats();
    const activeCategories = stats.categories.filter((cat) => cat.isActive !== false);
    return ApiResponse.success(res, activeCategories, 'Property categories retrieved successfully');
  })
);

export const categoryRoutes = router;

