import { Router } from 'express';
import multer from 'multer';
import { UploadController } from './upload.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/utils/ApiError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, `Unsupported image format ${file.mimetype}. Allowed: JPG, PNG, WebP`));
    }
  },
});

const router = Router();

// Allow authenticated users (both admin and normal users) to upload images
router.use(authenticate);

// Single image upload (accepts field name 'file' or 'image')
router.post(
  '/',
  (req, res, next) => {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('File size exceeds the 10MB limit'));
        }
        return next(err);
      }
      const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
      req.file = filesMap?.file?.[0] || filesMap?.image?.[0];
      next();
    });
  },
  asyncHandler(UploadController.uploadSingle)
);

// Multiple image upload (accepts field name 'files' or 'images', up to 20 images)
router.post(
  '/multiple',
  (req, res, next) => {
    upload.fields([
      { name: 'files', maxCount: 20 },
      { name: 'images', maxCount: 20 },
    ])(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('One or more files exceed the 10MB size limit'));
        }
        return next(err);
      }
      const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
      req.files = [...(filesMap?.files || []), ...(filesMap?.images || [])];
      next();
    });
  },
  asyncHandler(UploadController.uploadMultiple)
);

// Delete uploaded image by storageKey
router.delete('/:storageKey', asyncHandler(UploadController.deleteFile));

export const uploadRoutes = router;

