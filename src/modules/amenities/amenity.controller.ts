import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { ApiError } from '../../common/utils/ApiError.js';

export class AmenityController {
  static async listAmenities(_req: Request, res: Response) {
    const amenities = await prisma.amenity.findMany({
      include: {
        _count: {
          select: { properties: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return ApiResponse.success(res, amenities, 'Amenities retrieved successfully');
  }

  static async createAmenity(req: Request, res: Response) {
    const { name, icon, imageUrl } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw ApiError.badRequest('Amenity name is required');
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const existing = await prisma.amenity.findFirst({
      where: { OR: [{ name: name.trim() }, { slug }] },
    });

    if (existing) {
      throw ApiError.conflict('An amenity or feature with this name already exists');
    }

    const created = await prisma.amenity.create({
      data: {
        name: name.trim(),
        slug,
        icon: icon?.trim() || 'check_circle',
        imageUrl: imageUrl?.trim() || null,
      },
    });

    return ApiResponse.created(res, created, 'Amenity / Category feature created successfully');
  }

  static async updateAmenity(req: Request, res: Response) {
    const { id } = req.params;
    const { name, icon, imageUrl } = req.body;

    const existing = await prisma.amenity.findUnique({ where: { id: String(id) } });
    if (!existing) {
      throw ApiError.notFound('Amenity not found');
    }

    const updated = await prisma.amenity.update({
      where: { id: String(id) },
      data: {
        ...(name ? { name: name.trim(), slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') } : {}),
        ...(icon !== undefined ? { icon: icon?.trim() || 'check_circle' } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl?.trim() || null } : {}),
      },
    });

    return ApiResponse.success(res, updated, 'Amenity updated successfully');
  }

  static async deleteAmenity(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await prisma.amenity.findUnique({ where: { id: String(id) } });
    if (!existing) {
      throw ApiError.notFound('Amenity not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyAmenity.deleteMany({ where: { amenityId: String(id) } });
      await tx.amenity.delete({ where: { id: String(id) } });
    });

    return ApiResponse.success(res, null, 'Amenity removed successfully');
  }
}
