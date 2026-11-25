import { Router } from 'express';
import { AmenityController } from './amenity.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireAdmin } from '../../common/middleware/authorize.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// Public: list all amenities
router.get('/', asyncHandler(AmenityController.listAmenities));

// Admin: Manage amenities / features
router.post('/', authenticate, requireAdmin, asyncHandler(AmenityController.createAmenity));
router.patch('/:id', authenticate, requireAdmin, asyncHandler(AmenityController.updateAmenity));
router.delete('/:id', authenticate, requireAdmin, asyncHandler(AmenityController.deleteAmenity));

export const amenityRoutes = router;
