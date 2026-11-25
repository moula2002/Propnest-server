import { Router } from 'express';
import { LocationController } from './location.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

router.get('/search', asyncHandler(LocationController.searchLocations));

export const locationRoutes = router;

