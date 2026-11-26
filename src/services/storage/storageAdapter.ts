import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { logger } from '../../config/logger.js';

export interface UploadResult {
  storageKey: string;
  imageUrl: string;
  thumbnailUrl?: string;
}

export interface IStorageAdapter {
  uploadFile(file: Express.Multer.File): Promise<UploadResult>;
  deleteFile(storageKey: string): Promise<boolean>;
}

export class LocalStorageAdapter implements IStorageAdapter {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIRECTORY);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedExts.includes(ext)) {
      throw ApiError.badRequest(`Unsupported file extension ${ext}. Allowed: ${allowedExts.join(', ')}`);
    }

    const uniqueId = uuidv4();
    const safeFilename = `${uniqueId}${ext}`;
    const destinationPath = path.join(this.uploadDir, safeFilename);

    // Prevent directory traversal attacks
    if (!destinationPath.startsWith(this.uploadDir)) {
      throw ApiError.badRequest('Invalid destination path');
    }

    await fs.promises.writeFile(destinationPath, file.buffer);

    // Persist permanently into PostgreSQL database
    try {
      const bytes = new Uint8Array(file.buffer);
      await prisma.uploadedFile.upsert({
        where: { filename: safeFilename },
        update: {
          mimeType: file.mimetype,
          size: file.size,
          data: bytes,
        },
        create: {
          filename: safeFilename,
          mimeType: file.mimetype,
          size: file.size,
          data: bytes,
        },
      });
    } catch (dbErr) {
      logger.error('Failed to persist uploaded file to PostgreSQL:', dbErr);
    }

    const relativePath = `/uploads/${safeFilename}`;
    return {
      storageKey: safeFilename,
      imageUrl: relativePath,
      thumbnailUrl: relativePath,
    };
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const sanitized = path.basename(storageKey);
      const filePath = path.join(this.uploadDir, sanitized);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      try {
        await prisma.uploadedFile.deleteMany({
          where: { filename: sanitized },
        });
      } catch (delErr) {
        logger.warn('Could not delete file record from database:', delErr);
      }
      return true;
    } catch (error) {
      logger.error(`Failed to delete local file ${storageKey}:`, error);
      return false;
    }
  }
}

export class CloudinaryStorageAdapter implements IStorageAdapter {
  constructor() {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_SECRET) {
      throw ApiError.internal('Cloudinary storage is enabled but credentials are not configured.');
    }

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'propnest/properties',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error || !result) {
            logger.error('Cloudinary upload error:', error);
            return reject(ApiError.internal('Failed to upload image to Cloudinary'));
          }

          resolve({
            storageKey: result.public_id,
            imageUrl: result.secure_url,
            thumbnailUrl: result.secure_url.replace('/upload/', '/upload/c_thumb,w_300,h_200/'),
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const res = await cloudinary.uploader.destroy(storageKey);
      return res.result === 'ok';
    } catch (error) {
      logger.error(`Failed to delete Cloudinary file ${storageKey}:`, error);
      return false;
    }
  }
}

export function getStorageService(): IStorageAdapter {
  if (env.STORAGE_PROVIDER === 'cloudinary' && env.CLOUDINARY_API_KEY) {
    return new CloudinaryStorageAdapter();
  }
  return new LocalStorageAdapter();
}

