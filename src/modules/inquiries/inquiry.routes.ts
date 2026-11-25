import { Router } from 'express';
import { InquiryController } from './inquiry.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';
import { inquiryLimiter } from '../../common/middleware/rateLimiter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { createInquirySchema, createContactInquirySchema, updateInquiryStatusSchema } from './inquiry.validation.js';

const router = Router();

// Public Contact Us submission (Guest or Authenticated)
router.post(
  '/contact',
  inquiryLimiter,
  (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticate(req, res, next);
    }
    next();
  },
  validateRequest(createContactInquirySchema),
  asyncHandler(InquiryController.createContactInquiry)
);

// Inquiries specific to a user
router.get('/my-inquiries', authenticate, asyncHandler(InquiryController.getMyInquiries));
router.get('/received', authenticate, asyncHandler(InquiryController.getReceivedInquiries));
router.get('/:id', authenticate, asyncHandler(InquiryController.getInquiry));
router.patch('/:id/status', authenticate, validateRequest(updateInquiryStatusSchema), asyncHandler(InquiryController.updateStatus));

// Submit inquiry for property (Guest or Authenticated)
router.post(
  '/:propertyId/inquiries',
  inquiryLimiter,
  (req, res, next) => {
    // Optional authentication check: if Authorization header is present, try decoding
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticate(req, res, next);
    }
    next();
  },
  validateRequest(createInquirySchema),
  asyncHandler(InquiryController.createInquiry)
);

export const inquiryRoutes = router;

