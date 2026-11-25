import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { PropertyStatus } from '@prisma/client';
import { getStorageService } from '../../services/storage/storageAdapter.js';

export class UserController {
  static async getProfile(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        emailVerified: true,
        phoneVerified: true,
        profileImage: true,
        createdAt: true,
      },
    });

    if (!user) throw ApiError.notFound('User not found');
    return ApiResponse.success(res, user, 'Profile retrieved successfully');
  }

  static async updateProfile(req: Request, res: Response) {
    const { fullName, phone, profileImage } = req.body;

    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone, id: { not: req.user!.id }, deletedAt: null },
      });
      if (existingPhone) {
        throw ApiError.conflict('Phone number already associated with another account');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(fullName ? { fullName: fullName.trim() } : {}),
        ...(phone ? { phone: phone.trim() } : {}),
        ...(profileImage ? { profileImage } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true,
        updatedAt: true,
      },
    });

    return ApiResponse.success(res, updatedUser, 'Profile updated successfully');
  }

  static async uploadAvatar(req: Request, res: Response) {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No avatar image provided');

    const storage = getStorageService();
    const result = await storage.uploadFile(file);
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const absoluteUrl = `${protocol}://${host}${result.imageUrl}`;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { profileImage: absoluteUrl },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true,
      },
    });

    return ApiResponse.success(res, updated, 'Avatar uploaded and profile updated successfully');
  }

  static async getMyProperties(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as PropertyStatus | undefined;

    const where: any = {
      ownerId: req.user!.id,
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: {
            orderBy: { displayOrder: 'asc' },
            take: 3,
          },
          _count: {
            select: { favorites: true, inquiries: true },
          },
        },
      }),
    ]);

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, properties, 'User properties retrieved', 200, meta);
  }
}

