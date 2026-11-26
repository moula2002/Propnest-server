import { Request, Response } from 'express';
import { getStorageService } from '../../services/storage/storageAdapter.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { ApiError } from '../../common/utils/ApiError.js';

export class UploadController {
  static async uploadSingle(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      throw ApiError.badRequest('No image file provided in the upload request');
    }

    const storage = getStorageService();
    const result = await storage.uploadFile(file);
    const host = req.get('host') || 'localhost:5000';
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : null) || req.protocol || (host.includes('localhost') ? 'http' : 'https');
    const safeProtocol = host.includes('localhost') ? protocol : 'https';
    const absoluteUrl = result.imageUrl.startsWith('http')
      ? result.imageUrl
      : `${safeProtocol}://${host}${result.imageUrl}`;

    return ApiResponse.created(
      res,
      {
        url: absoluteUrl,
        path: result.imageUrl,
        storageKey: result.storageKey,
      },
      'Image uploaded successfully'
    );
  }

  static async uploadMultiple(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw ApiError.badRequest('No image files provided for upload');
    }

    const storage = getStorageService();
    const host = req.get('host') || 'localhost:5000';
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : null) || req.protocol || (host.includes('localhost') ? 'http' : 'https');
    const safeProtocol = host.includes('localhost') ? protocol : 'https';

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const result = await storage.uploadFile(file);
        return {
          url: result.imageUrl.startsWith('http')
            ? result.imageUrl
            : `${safeProtocol}://${host}${result.imageUrl}`,
          path: result.imageUrl,
          storageKey: result.storageKey,
        };
      })
    );

    return ApiResponse.created(res, uploaded, `${uploaded.length} image(s) uploaded successfully`);
  }

  static async deleteFile(req: Request, res: Response) {
    const { storageKey } = req.params;
    if (!storageKey) {
      throw ApiError.badRequest('Storage key is required to delete file');
    }

    const storage = getStorageService();
    await storage.deleteFile(String(storageKey));
    return ApiResponse.success(res, null, 'Image deleted successfully');
  }
}

