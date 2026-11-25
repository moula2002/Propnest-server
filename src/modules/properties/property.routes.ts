import { Router } from 'express';
import multer from 'multer';
import { PropertyController } from './property.controller.js';
import { InquiryController } from '../inquiries/inquiry.controller.js';
import { authenticate, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { requirePropertyOwnerOrAdmin } from '../../common/middleware/authorize.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';
import { inquiryLimiter } from '../../common/middleware/rateLimiter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import {
  createPropertySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
  reorderImagesSchema,
} from './property.validation.js';
import { createInquirySchema } from '../inquiries/inquiry.validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max per file
});

const router = Router();

// Public Property Discovery
router.get('/', asyncHandler(PropertyController.listProperties));
router.get('/:id', optionalAuthenticate, asyncHandler(PropertyController.getProperty));
router.get('/slug/:slug', optionalAuthenticate, asyncHandler(PropertyController.getProperty));
router.get('/:id/similar', asyncHandler(PropertyController.getSimilarProperties));

// Submit Inquiry on Property (Guest or Authenticated)
router.post(
  '/:id/inquiries',
  inquiryLimiter,
  (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticate(req, res, next);
    }
    next();
  },
  validateRequest(createInquirySchema),
  asyncHandler(InquiryController.createInquiry)
);

// Authenticated Property Management
router.post('/', authenticate, validateRequest(createPropertySchema), asyncHandler(PropertyController.createProperty));
router.patch('/:id', authenticate, requirePropertyOwnerOrAdmin, validateRequest(updatePropertySchema), asyncHandler(PropertyController.updateProperty));
router.patch('/:id/status', authenticate, requirePropertyOwnerOrAdmin, validateRequest(updatePropertyStatusSchema), asyncHandler(PropertyController.updateStatus));
router.patch('/:id/submit-for-approval', authenticate, requirePropertyOwnerOrAdmin, asyncHandler(PropertyController.submitForApproval));
router.delete('/:id', authenticate, requirePropertyOwnerOrAdmin, asyncHandler(PropertyController.deleteProperty));

// Property Gallery / Images
router.post(
  '/:id/images',
  authenticate,
  requirePropertyOwnerOrAdmin,
  upload.array('images', 10),
  asyncHandler(PropertyController.uploadImages)
);
router.delete(
  '/:id/images/:imageId',
  authenticate,
  requirePropertyOwnerOrAdmin,
  asyncHandler(PropertyController.deleteImage)
);
router.patch(
  '/:id/images/:imageId/primary',
  authenticate,
  requirePropertyOwnerOrAdmin,
  asyncHandler(PropertyController.setPrimaryImage)
);
router.patch(
  '/:id/images/reorder',
  authenticate,
  requirePropertyOwnerOrAdmin,
  validateRequest(reorderImagesSchema),
  asyncHandler(PropertyController.reorderImages)
);

export const propertyRoutes = router;
