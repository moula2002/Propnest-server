import { Prisma, PropertyStatus, ListingType, FurnishingStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';

export class PropertySearchService {
  static async searchProperties(query: any, skip: number, take: number) {
    const where: Prisma.PropertyWhereInput = {
      status: PropertyStatus.APPROVED,
      deletedAt: null,
    };

    // Keyword search across title, description, locality, city
    if (query.keyword && typeof query.keyword === 'string') {
      const kw = query.keyword.trim();
      if (kw.length > 0) {
        where.OR = [
          { title: { contains: kw, mode: 'insensitive' } },
          { description: { contains: kw, mode: 'insensitive' } },
          { locality: { contains: kw, mode: 'insensitive' } },
          { city: { contains: kw, mode: 'insensitive' } },
          { address: { contains: kw, mode: 'insensitive' } },
        ];
      }
    }

    if (query.city && typeof query.city === 'string') {
      where.city = { equals: query.city.trim(), mode: 'insensitive' };
    }

    if (query.locality && typeof query.locality === 'string') {
      where.locality = { equals: query.locality.trim(), mode: 'insensitive' };
    }

    if (query.state && typeof query.state === 'string') {
      where.state = { equals: query.state.trim(), mode: 'insensitive' };
    }

    if (query.postalCode && typeof query.postalCode === 'string') {
      where.postalCode = query.postalCode.trim();
    }

    if (query.propertyType && typeof query.propertyType === 'string' && query.propertyType.trim().length > 0) {
      where.propertyType = query.propertyType.trim().toUpperCase();
    }

    if (query.listingType && Object.values(ListingType).includes(query.listingType)) {
      where.listingType = query.listingType;
    }

    if (query.furnishingStatus && Object.values(FurnishingStatus).includes(query.furnishingStatus)) {
      where.furnishingStatus = query.furnishingStatus;
    }

    // Price range
    const minPrice = query.minPrice ? Number(query.minPrice) : undefined;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined && !isNaN(minPrice)) where.price.gte = minPrice;
      if (maxPrice !== undefined && !isNaN(maxPrice)) where.price.lte = maxPrice;
    }

    // Bedrooms
    if (query.bedrooms !== undefined && !isNaN(Number(query.bedrooms))) {
      where.bedrooms = Number(query.bedrooms);
    } else {
      const minBedrooms = query.minBedrooms ? Number(query.minBedrooms) : undefined;
      const maxBedrooms = query.maxBedrooms ? Number(query.maxBedrooms) : undefined;
      if (minBedrooms !== undefined || maxBedrooms !== undefined) {
        where.bedrooms = {};
        if (minBedrooms !== undefined && !isNaN(minBedrooms)) where.bedrooms.gte = minBedrooms;
        if (maxBedrooms !== undefined && !isNaN(maxBedrooms)) where.bedrooms.lte = maxBedrooms;
      }
    }

    // Bathrooms
    if (query.bathrooms !== undefined && !isNaN(Number(query.bathrooms))) {
      where.bathrooms = Number(query.bathrooms);
    }

    // Carpet Area
    const minArea = query.minArea ? Number(query.minArea) : undefined;
    const maxArea = query.maxArea ? Number(query.maxArea) : undefined;
    if (minArea !== undefined || maxArea !== undefined) {
      where.carpetArea = {};
      if (minArea !== undefined && !isNaN(minArea)) where.carpetArea.gte = minArea;
      if (maxArea !== undefined && !isNaN(maxArea)) where.carpetArea.lte = maxArea;
    }

    // Verified only filter
    if (query.verifiedOnly === 'true' || query.verifiedOnly === true) {
      where.verifiedAt = { not: null };
    }

    // Featured & Latest filters (independent boolean filtering)
    if (query.isFeatured === 'true' || query.isFeatured === true) {
      where.isFeatured = true;
    } else if (query.isFeatured === 'false' || query.isFeatured === false) {
      where.isFeatured = false;
    }
    if (query.isLatest === 'true' || query.isLatest === true) {
      where.isLatest = true;
    } else if (query.isLatest === 'false' || query.isLatest === false) {
      where.isLatest = false;
    }

    // Filter by Amenities (comma-separated slugs or IDs)
    if (query.amenities && typeof query.amenities === 'string') {
      const amenityList = query.amenities.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (amenityList.length > 0) {
        where.amenities = {
          some: {
            amenity: {
              OR: [
                { id: { in: amenityList } },
                { slug: { in: amenityList } },
              ],
            },
          },
        };
      }
    }

    // Sorting
    let orderBy: Prisma.PropertyOrderByWithRelationInput = { createdAt: 'desc' };
    const sort = query.sortBy || query.sort;

    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'price_low_to_high':
        orderBy = { price: 'asc' };
        break;
      case 'price_high_to_low':
        orderBy = { price: 'desc' };
        break;
      case 'area_low_to_high':
        orderBy = { carpetArea: 'asc' };
        break;
      case 'area_high_to_low':
        orderBy = { carpetArea: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Optimized parallel execution using Prisma select & includes
    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          propertyType: true,
          listingType: true,
          price: true,
          negotiable: true,
          bedrooms: true,
          bathrooms: true,
          carpetArea: true,
          areaUnit: true,
          furnishingStatus: true,
          possessionStatus: true,
          city: true,
          locality: true,
          state: true,
          postalCode: true,
          isFeatured: true,
          isLatest: true,
          verifiedAt: true,
          publishedAt: true,
          createdAt: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              altText: true,
            },
          },
          _count: {
            select: {
              images: true,
              amenities: true,
              favorites: true,
            },
          },
        },
      }),
    ]);

    return { total, properties };
  }

  static async getSimilarProperties(propertyId: string) {
    const current = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        city: true,
        locality: true,
        propertyType: true,
        listingType: true,
        price: true,
        bedrooms: true,
      },
    });

    if (!current) {
      throw ApiError.notFound('Property not found');
    }

    const currentPrice = Number(current.price);
    const minPrice = currentPrice * 0.7; // -30%
    const maxPrice = currentPrice * 1.3; // +30%

    const similar = await prisma.property.findMany({
      where: {
        id: { not: current.id },
        city: current.city,
        status: PropertyStatus.APPROVED,
        deletedAt: null,
        propertyType: current.propertyType,
        listingType: current.listingType,
        price: { gte: minPrice, lte: maxPrice },
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        propertyType: true,
        listingType: true,
        bedrooms: true,
        bathrooms: true,
        carpetArea: true,
        areaUnit: true,
        city: true,
        locality: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { imageUrl: true, thumbnailUrl: true },
        },
      },
    });

    return similar;
  }
}

