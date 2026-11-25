import { Router } from 'express';
import multer from 'multer';
import { UserController } from './user.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';
import { updateProfileSchema } from '../auth/auth.validation.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatar
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatar'));
    }
  },
});

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(UserController.getProfile));
router.patch('/me', validateRequest(updateProfileSchema), asyncHandler(UserController.updateProfile));
router.patch('/me/avatar', upload.single('avatar'), asyncHandler(UserController.uploadAvatar));
router.get('/me/properties', asyncHandler(UserController.getMyProperties));

export const userRoutes = router;

