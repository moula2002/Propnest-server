import { Router } from 'express';
import { HealthController } from './health.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(HealthController.check));

export const healthRoutes = router;

