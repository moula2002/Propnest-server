import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { PropertyStatus } from '@prisma/client';

export class FavoriteService {
  static async addFavorite(userId: string, propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    if (property.status !== PropertyStatus.APPROVED) {
      throw ApiError.badRequest('Cannot favorite a property that is not currently approved');
    }

    try {
      const favorite = await prisma.favorite.create({
        data: { userId, propertyId },
      });
      return favorite;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw ApiError.conflict('Property is already in your favorites');
      }
      throw err;
    }
  }

  static async removeFavorite(userId: string, propertyId: string) {
    const favorite = await prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });

    if (!favorite) {
      throw ApiError.notFound('Property is not in your favorites');
    }

    await prisma.favorite.delete({
      where: { id: favorite.id },
    });
  }

  static async getUserFavorites(userId: string, skip: number, take: number) {
    const where = {
      userId,
      property: {
        deletedAt: null,
      },
    };

    const [total, favorites] = await Promise.all([
      prisma.favorite.count({ where }),
      prisma.favorite.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              slug: true,
              price: true,
              propertyType: true,
              listingType: true,
              city: true,
              locality: true,
              bedrooms: true,
              bathrooms: true,
              carpetArea: true,
              areaUnit: true,
              status: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { imageUrl: true, thumbnailUrl: true },
              },
            },
          },
        },
      }),
    ]);

    return { total, favorites };
  }
}

