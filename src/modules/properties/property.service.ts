import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { PropertyStatus, Role, Prisma } from '@prisma/client';
import { getStorageService } from '../../services/email/../storage/storageAdapter.js';

export class PropertyService {
  private static generateSlug(title: string, city: string): string {
    const baseSlug = `${title} ${city}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${uniqueSuffix}`;
  }

  static async createProperty(ownerId: string, data: any) {
    const slug = this.generateSlug(data.title, data.city);
    const amenityIds: string[] = data.amenityIds || [];
    const images: any[] = Array.isArray(data.images) ? data.images : [];
    delete data.amenityIds;
    delete data.images;

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          ...data,
          ownerId,
          slug,
          status: PropertyStatus.DRAFT, // All new properties start in DRAFT
        },
      });

      if (amenityIds.length > 0) {
        await tx.propertyAmenity.createMany({
          data: amenityIds.map((amenityId) => ({
            propertyId: created.id,
            amenityId,
          })),
          skipDuplicates: true,
        });
      }

      if (images.length > 0) {
        const imageRecords = images.map((img: any, idx: number) => {
          const imageUrl = typeof img === 'string' ? img : img.imageUrl;
          const altText = typeof img === 'object' && img.altText ? img.altText : `${created.title} - Image ${idx + 1}`;
          const isPrimary = typeof img === 'object' && img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0;
          const storageKey = typeof img === 'object' && img.storageKey ? img.storageKey : `uploads/${created.id}-${idx}`;
          return {
            propertyId: created.id,
            storageKey,
            imageUrl,
            thumbnailUrl: typeof img === 'object' && img.thumbnailUrl ? img.thumbnailUrl : null,
            altText,
            displayOrder: typeof img === 'object' && img.displayOrder !== undefined ? Number(img.displayOrder) : idx,
            isPrimary,
          };
        });

        await tx.propertyImage.createMany({
          data: imageRecords,
        });
      }

      return tx.property.findUnique({
        where: { id: created.id },
        include: {
          amenities: { include: { amenity: true } },
          images: { orderBy: { displayOrder: 'asc' } },
        },
      });
    });

    return property;
  }

  static async getPropertyByIdOrSlug(identifier: string, requestingUser?: { id: string; role: Role }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

    const property = await prisma.property.findFirst({
      where: {
        ...(isUuid ? { id: identifier } : { slug: identifier }),
        deletedAt: null,
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        amenities: { include: { amenity: true } },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            profileImage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!property) {
      throw ApiError.notFound('Property not found');
    }

    const isOwner = requestingUser && property.ownerId === requestingUser.id;
    const isAdmin = requestingUser && (requestingUser.role === Role.ADMIN || requestingUser.role === Role.SUPER_ADMIN);

    // Public users can ONLY view APPROVED properties
    if (property.status !== PropertyStatus.APPROVED && !isOwner && !isAdmin) {
      throw ApiError.notFound('Property listing is not currently available');
    }

    return property;
  }

  static async updateProperty(propertyId: string, userId: string, userRole: Role, data: any) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    const isOwner = property.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You are not authorized to update this property');
    }

    const amenityIds: string[] | undefined = data.amenityIds;
    const images: any[] | undefined = Array.isArray(data.images) ? data.images : undefined;
    delete data.amenityIds;
    delete data.images;

    // Disallow overriding immutable fields
    delete data.id;
    delete data.ownerId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.deletedAt;

    const updated = await prisma.$transaction(async (tx) => {
      if (amenityIds !== undefined) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId } });
        if (amenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: amenityIds.map((id) => ({ propertyId, amenityId: id })),
            skipDuplicates: true,
          });
        }
      }

      if (images !== undefined) {
        await tx.propertyImage.deleteMany({ where: { propertyId } });
        if (images.length > 0) {
          const imageRecords = images.map((img: any, idx: number) => {
            const imageUrl = typeof img === 'string' ? img : img.imageUrl;
            const altText = typeof img === 'object' && img.altText ? img.altText : `Property Image ${idx + 1}`;
            const isPrimary = typeof img === 'object' && img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0;
            const storageKey = typeof img === 'object' && img.storageKey ? img.storageKey : `uploads/${propertyId}-${idx}`;
            return {
              propertyId,
              storageKey,
              imageUrl,
              thumbnailUrl: typeof img === 'object' && img.thumbnailUrl ? img.thumbnailUrl : null,
              altText,
              displayOrder: typeof img === 'object' && img.displayOrder !== undefined ? Number(img.displayOrder) : idx,
              isPrimary,
            };
          });

          await tx.propertyImage.createMany({
            data: imageRecords,
          });
        }
      }

      return tx.property.update({
        where: { id: propertyId },
        data,
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          amenities: { include: { amenity: true } },
        },
      });
    });

    return updated;
  }

  static async updatePropertyStatus(propertyId: string, userId: string, userRole: Role, newStatus: PropertyStatus) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    const isOwner = property.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('Not authorized to update property status');
    }

    // Owner status transitions state machine:
    // DRAFT -> PENDING_APPROVAL
    // APPROVED -> SOLD | RENTED | ARCHIVED
    // SOLD | RENTED | ARCHIVED -> APPROVED
    if (!isAdmin) {
      const allowedOwnerTransitions: Record<PropertyStatus, PropertyStatus[]> = {
        [PropertyStatus.DRAFT]: [PropertyStatus.PENDING_APPROVAL],
        [PropertyStatus.PENDING_APPROVAL]: [PropertyStatus.DRAFT],
        [PropertyStatus.APPROVED]: [PropertyStatus.SOLD, PropertyStatus.RENTED, PropertyStatus.ARCHIVED],
        [PropertyStatus.REJECTED]: [PropertyStatus.PENDING_APPROVAL],
        [PropertyStatus.SOLD]: [PropertyStatus.APPROVED, PropertyStatus.ARCHIVED],
        [PropertyStatus.RENTED]: [PropertyStatus.APPROVED, PropertyStatus.ARCHIVED],
        [PropertyStatus.ARCHIVED]: [PropertyStatus.APPROVED, PropertyStatus.DRAFT],
      };

      if (!allowedOwnerTransitions[property.status]?.includes(newStatus)) {
        throw ApiError.badRequest(
          `Invalid status transition from ${property.status} to ${newStatus}. Owner may only submit for approval or change availability.`
        );
      }
    }

    const updatePayload: Prisma.PropertyUpdateInput = { status: newStatus };
    if (newStatus === PropertyStatus.APPROVED && !property.publishedAt) {
      updatePayload.publishedAt = new Date();
      updatePayload.verifiedAt = new Date();
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: updatePayload,
    });

    return updated;
  }

  static async deleteProperty(propertyId: string, userId: string, userRole: Role) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    const isOwner = property.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You are not authorized to delete this property');
    }

    // Soft delete
    await prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date(), status: PropertyStatus.ARCHIVED },
    });
  }

  // --- Image Operations ---

  static async uploadPropertyImages(propertyId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw ApiError.badRequest('No image files provided');
    }

    const existingCount = await prisma.propertyImage.count({ where: { propertyId } });
    const MAX_IMAGES = 15;
    if (existingCount + files.length > MAX_IMAGES) {
      throw ApiError.badRequest(`Maximum ${MAX_IMAGES} images allowed per property. Current: ${existingCount}.`);
    }

    const storage = getStorageService();
    const uploadedRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await storage.uploadFile(file);
      const isFirst = existingCount === 0 && i === 0;

      const record = await prisma.propertyImage.create({
        data: {
          propertyId,
          storageKey: result.storageKey,
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          altText: file.originalname,
          displayOrder: existingCount + i,
          isPrimary: isFirst,
        },
      });
      uploadedRecords.push(record);
    }

    return uploadedRecords;
  }

  static async deletePropertyImage(propertyId: string, imageId: string) {
    const image = await prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });

    if (!image) {
      throw ApiError.notFound('Property image not found');
    }

    const storage = getStorageService();
    await storage.deleteFile(image.storageKey);

    await prisma.propertyImage.delete({ where: { id: imageId } });

    // If deleted image was primary, set another remaining image as primary
    if (image.isPrimary) {
      const nextImage = await prisma.propertyImage.findFirst({
        where: { propertyId },
        orderBy: { displayOrder: 'asc' },
      });
      if (nextImage) {
        await prisma.propertyImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }
  }

  static async setPrimaryImage(propertyId: string, imageId: string) {
    const image = await prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });

    if (!image) {
      throw ApiError.notFound('Property image not found');
    }

    await prisma.$transaction([
      prisma.propertyImage.updateMany({
        where: { propertyId },
        data: { isPrimary: false },
      }),
      prisma.propertyImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);
  }

  static async reorderImages(propertyId: string, imageOrders: { imageId: string; displayOrder: number }[]) {
    await prisma.$transaction(
      imageOrders.map((item) =>
        prisma.propertyImage.updateMany({
          where: { id: item.imageId, propertyId },
          data: { displayOrder: item.displayOrder },
        })
      )
    );
  }
}

