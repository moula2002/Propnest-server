import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authLimiter } from '../../common/middleware/rateLimiter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), asyncHandler(AuthController.register));
router.post('/login', authLimiter, validateRequest(loginSchema), asyncHandler(AuthController.login));
router.post('/refresh', asyncHandler(AuthController.refresh));
router.post('/logout', asyncHandler(AuthController.logout));
router.post('/logout-all', authenticate, asyncHandler(AuthController.logoutAll));
router.get('/me', authenticate, asyncHandler(AuthController.getMe));
router.patch('/change-password', authenticate, validateRequest(changePasswordSchema), asyncHandler(AuthController.changePassword));
router.post('/forgot-password', authLimiter, validateRequest(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', authLimiter, validateRequest(resetPasswordSchema), asyncHandler(AuthController.resetPassword));

export const authRoutes = router;

