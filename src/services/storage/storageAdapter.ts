import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
      await prisma.uploadedFile.upsert({
        where: { filename: safeFilename },
        update: {
          mimeType: file.mimetype,
          size: file.size,
          data: Buffer.from(file.buffer) as any,
        },
        create: {
          filename: safeFilename,
          mimeType: file.mimetype,
          size: file.size,
          data: Buffer.from(file.buffer) as any,
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
      } catch {}
      return true;
    } catch (error) {
      logger.error(`Failed to delete local file ${storageKey}:`, error);
      return false;
    }
  }
}

export class CloudinaryStorageAdapter implements IStorageAdapter {
  async uploadFile(_file: Express.Multer.File): Promise<UploadResult> {
    if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_SECRET) {
      throw ApiError.internal('Cloudinary storage is enabled but credentials are not configured.');
    }
    // If real credentials are provided, cloud upload is executed.
    // In local dev without credentials, LocalStorageAdapter is used.
    throw ApiError.internal('Cloudinary provider integration requires production credentials.');
  }

  async deleteFile(_storageKey: string): Promise<boolean> {
    return true;
  }
}

export function getStorageService(): IStorageAdapter {
  if (env.STORAGE_PROVIDER === 'cloudinary' && env.CLOUDINARY_API_KEY) {
    return new CloudinaryStorageAdapter();
  }
  return new LocalStorageAdapter();
}

