import { z } from 'zod';
import { ListingType, PropertyStatus, FurnishingStatus, PossessionStatus } from '@prisma/client';

export const createPropertySchema = z.object({
  body: z.object({
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(255),
    description: z.string().trim().min(20, 'Description must be at least 20 characters'),
    propertyType: z.string().trim().min(2, 'Property category is required').max(50).transform((v) => v.toUpperCase()),
    listingType: z.nativeEnum(ListingType),
    price: z.coerce.number().positive('Price must be greater than 0'),
    negotiable: z.boolean().default(false),
    bedrooms: z.coerce.number().int().min(0).default(0),
    bathrooms: z.coerce.number().int().min(0).default(0),
    balconies: z.coerce.number().int().min(0).default(0),
    builtUpArea: z.coerce.number().positive().optional(),
    carpetArea: z.coerce.number().positive('Carpet area is required and must be positive'),
    plotArea: z.coerce.number().positive().optional(),
    areaUnit: z.string().default('sqft'),
    floorNumber: z.coerce.number().int().optional(),
    totalFloors: z.coerce.number().int().optional(),
    furnishingStatus: z.nativeEnum(FurnishingStatus).default(FurnishingStatus.UNFURNISHED),
    possessionStatus: z.nativeEnum(PossessionStatus).default(PossessionStatus.READY_TO_MOVE),
    constructionStatus: z.string().max(50).optional(),
    propertyAge: z.string().max(50).optional(),
    facing: z.string().max(50).optional(),
    parkingSpaces: z.coerce.number().int().min(0).default(0),
    city: z.string().trim().min(2).max(100),
    locality: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    country: z.string().trim().default('India'),
    postalCode: z.string().trim().min(4).max(20),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    address: z.string().trim().min(5),
    landmark: z.string().trim().max(255).optional(),
    amenityIds: z.array(z.string().uuid()).optional(),
    isFeatured: z.boolean().optional(),
    isLatest: z.boolean().optional(),
  }),
});

export const updatePropertySchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(255).optional(),
    description: z.string().trim().min(20).optional(),
    propertyType: z.string().trim().min(2).max(50).transform((v) => v.toUpperCase()).optional(),
    listingType: z.nativeEnum(ListingType).optional(),
    price: z.coerce.number().positive().optional(),
    negotiable: z.boolean().optional(),
    bedrooms: z.coerce.number().int().min(0).optional(),
    bathrooms: z.coerce.number().int().min(0).optional(),
    balconies: z.coerce.number().int().min(0).optional(),
    builtUpArea: z.coerce.number().positive().optional(),
    carpetArea: z.coerce.number().positive().optional(),
    plotArea: z.coerce.number().positive().optional(),
    areaUnit: z.string().optional(),
    floorNumber: z.coerce.number().int().optional(),
    totalFloors: z.coerce.number().int().optional(),
    furnishingStatus: z.nativeEnum(FurnishingStatus).optional(),
    possessionStatus: z.nativeEnum(PossessionStatus).optional(),
    constructionStatus: z.string().max(50).optional(),
    propertyAge: z.string().max(50).optional(),
    facing: z.string().max(50).optional(),
    parkingSpaces: z.coerce.number().int().min(0).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    locality: z.string().trim().min(2).max(100).optional(),
    state: z.string().trim().min(2).max(100).optional(),
    postalCode: z.string().trim().min(4).max(20).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    address: z.string().trim().min(5).optional(),
    landmark: z.string().trim().max(255).optional(),
    amenityIds: z.array(z.string().uuid()).optional(),
    isFeatured: z.boolean().optional(),
    isLatest: z.boolean().optional(),
  }),
});

export const updatePropertyStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      PropertyStatus.DRAFT,
      PropertyStatus.PENDING_APPROVAL,
      PropertyStatus.SOLD,
      PropertyStatus.RENTED,
      PropertyStatus.ARCHIVED,
      PropertyStatus.APPROVED,
    ]),
  }),
});

export const reorderImagesSchema = z.object({
  body: z.object({
    images: z.array(
      z.object({
        imageId: z.string().uuid(),
        displayOrder: z.number().int().min(0),
      })
    ).min(1, 'At least one image order must be provided'),
  }),
});

