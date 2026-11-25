import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { TokenService } from '../../services/security/tokenService.js';
import { PropertyStatus, AccountStatus, Role, InquiryStatus, ListingType } from '@prisma/client';

export class AdminService {
  /**
   * Secure Admin Login - strictly verifies Role.ADMIN or Role.SUPER_ADMIN
   */
  static async adminLogin(
    email: string,
    pass: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw ApiError.forbidden(`Account is ${user.accountStatus.toLowerCase()}. Access denied.`);
    }

    // Role check: Only ADMIN and SUPER_ADMIN allowed
    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw ApiError.forbidden('Access denied. Administrator privileges are required to log into the Admin Panel.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const accessToken = TokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      accountStatus: user.accountStatus,
    });

    const { token: refreshToken, expiresAt } = TokenService.signRefreshToken(user.id);
    const tokenHash = TokenService.hashToken(refreshToken);

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: meta?.ip,
        deviceInfo: meta?.userAgent,
      },
    });

    // Audit log successful login
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ADMIN_LOGIN',
        entityType: 'AUTH',
        entityId: user.id,
        metadata: { ip: meta?.ip, userAgent: meta?.userAgent },
        ipAddress: meta?.ip,
      },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
      },
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Complete 13 Dashboard Metrics
   */
  static async getDashboardMetrics() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalProperties,
      propertyStatusCounts,
      rentalProperties,
      totalInquiries,
      newInquiries,
      propertiesAddedToday,
      usersRegisteredToday,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { accountStatus: AccountStatus.ACTIVE, deletedAt: null } }),
      prisma.user.count({
        where: {
          accountStatus: { in: [AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED] },
          deletedAt: null,
        },
      }),
      prisma.property.count({ where: { deletedAt: null } }),
      prisma.property.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.count({
        where: { listingType: ListingType.RENT, deletedAt: null },
      }),
      prisma.inquiry.count(),
      prisma.inquiry.count({ where: { inquiryStatus: InquiryStatus.NEW } }),
      prisma.property.count({
        where: {
          createdAt: { gte: startOfToday },
          deletedAt: null,
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: startOfToday },
          deletedAt: null,
        },
      }),
    ]);

    const statusMap = propertyStatusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalProperties,
      activeProperties: statusMap[PropertyStatus.APPROVED] || 0,
      pendingProperties: statusMap[PropertyStatus.PENDING_APPROVAL] || 0,
      rejectedProperties: statusMap[PropertyStatus.REJECTED] || 0,
      soldProperties: statusMap[PropertyStatus.SOLD] || 0,
      rentalProperties,
      totalInquiries,
      newInquiries,
      propertiesAddedToday,
      usersRegisteredToday,
      // Nested objects for compatibility
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        registeredToday: usersRegisteredToday,
      },
      properties: {
        total: totalProperties,
        approved: statusMap[PropertyStatus.APPROVED] || 0,
        pendingApproval: statusMap[PropertyStatus.PENDING_APPROVAL] || 0,
        rejected: statusMap[PropertyStatus.REJECTED] || 0,
        draft: statusMap[PropertyStatus.DRAFT] || 0,
        sold: statusMap[PropertyStatus.SOLD] || 0,
        rented: statusMap[PropertyStatus.RENTED] || 0,
        rental: rentalProperties,
        archived: statusMap[PropertyStatus.ARCHIVED] || 0,
        addedToday: propertiesAddedToday,
      },
      inquiries: {
        total: totalInquiries,
        new: newInquiries,
      },
    };
  }

  /**
   * Recent Activity for Dashboard
   */
  static async getRecentActivity() {
    const [
      recentUsers,
      recentProperties,
      recentInquiries,
      pendingApprovals,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          accountStatus: true,
          createdAt: true,
        },
      }),
      prisma.property.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          images: { take: 1, select: { imageUrl: true } },
        },
      }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          property: { select: { id: true, title: true, city: true } },
          owner: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.property.findMany({
        where: { status: PropertyStatus.PENDING_APPROVAL, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          owner: { select: { id: true, fullName: true, email: true, phone: true } },
          images: { take: 1, select: { imageUrl: true } },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      recentUsers,
      recentProperties,
      recentInquiries,
      pendingApprovals,
      recentAuditLogs,
    };
  }

  /**
   * User Management
   */
  static async listUsers(options: {
    skip: number;
    take: number;
    search?: string;
    role?: Role;
    status?: AccountStatus;
    from?: string;
    to?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { skip, take, search, role, status, from, to, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const where: any = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(status ? { accountStatus: status } : {}),
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const allowedSortFields = ['createdAt', 'fullName', 'email', 'role', 'accountStatus'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [validSortBy]: sortOrder },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              properties: { where: { deletedAt: null } },
              buyerInquiries: true,
              receivedInquiries: true,
            },
          },
        },
      }),
    ]);

    return { total, users };
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        updatedAt: true,
        deletedAt: true,
        _count: {
          select: {
            properties: { where: { deletedAt: null } },
            buyerInquiries: true,
            receivedInquiries: true,
            favorites: true,
          },
        },
        properties: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            slug: true,
            city: true,
            locality: true,
            propertyType: true,
            listingType: true,
            price: true,
            status: true,
            createdAt: true,
          },
        },
        buyerInquiries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            property: { select: { id: true, title: true, city: true } },
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  static async updateUserStatus(adminId: string, targetUserId: string, newStatus: AccountStatus, reason?: string) {
    if (adminId === targetUserId) {
      throw ApiError.badRequest('Administrators cannot change their own account status');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw ApiError.notFound('User not found');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: { accountStatus: newStatus },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          accountStatus: true,
          updatedAt: true,
        },
      });

      if (newStatus !== AccountStatus.ACTIVE) {
        await tx.refreshSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'USER_STATUS_CHANGE',
          entityType: 'USER',
          entityId: targetUserId,
          metadata: { previousStatus: targetUser.accountStatus, newStatus, reason: reason || 'Status modified by administrator' },
        },
      });

      return u;
    });

    return updated;
  }

  static async updateUserRole(adminId: string, targetUserId: string, newRole: Role) {
    if (adminId === targetUserId) {
      throw ApiError.badRequest('Super administrators cannot modify their own role');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw ApiError.notFound('User not found');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          accountStatus: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'USER_ROLE_CHANGE',
          entityType: 'USER',
          entityId: targetUserId,
          metadata: { previousRole: targetUser.role, newRole },
        },
      });

      return u;
    });

    return updated;
  }

  /**
   * Property Management & Moderation
   */
  static async listProperties(options: {
    skip: number;
    take: number;
    search?: string;
    status?: PropertyStatus;
    city?: string;
    locality?: string;
    propertyType?: string;
    listingType?: ListingType;
    minPrice?: number;
    maxPrice?: number;
    from?: string;
    to?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      skip,
      take,
      search,
      status,
      city,
      locality,
      propertyType,
      listingType,
      minPrice,
      maxPrice,
      from,
      to,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: any = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(city ? { city: { contains: city.trim(), mode: 'insensitive' } } : {}),
      ...(locality ? { locality: { contains: locality.trim(), mode: 'insensitive' } } : {}),
      ...(propertyType ? { propertyType } : {}),
      ...(listingType ? { listingType } : {}),
    };

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { locality: { contains: q, mode: 'insensitive' } },
        { owner: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'price', 'title', 'status'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { [validSortBy]: sortOrder },
        include: {
          owner: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          images: {
            take: 1,
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            select: { id: true, imageUrl: true, thumbnailUrl: true, isPrimary: true },
          },
          _count: {
            select: { inquiries: true, favorites: true },
          },
        },
      }),
    ]);

    return { total, properties };
  }

  static async listPendingProperties(skip: number, take: number, search?: string) {
    return this.listProperties({
      skip,
      take,
      status: PropertyStatus.PENDING_APPROVAL,
      search,
    });
  }

  static async getPropertyById(propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
            accountStatus: true,
          },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
        },
        amenities: {
          include: { amenity: true },
        },
        moderationHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            admin: { select: { id: true, fullName: true, email: true } },
          },
        },
        _count: {
          select: { inquiries: true, favorites: true },
        },
      },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    return property;
  }

  static async approveProperty(adminId: string, propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.APPROVED,
          verifiedAt: new Date(),
          publishedAt: property.publishedAt || new Date(),
          rejectionReason: null,
        },
      });

      await tx.moderationHistory.create({
        data: {
          propertyId,
          adminId,
          action: 'APPROVE',
          previousStatus: property.status,
          newStatus: PropertyStatus.APPROVED,
          reason: 'Listing approved by administrator.',
        },
      });

      await tx.notification.create({
        data: {
          userId: property.ownerId,
          type: 'PROPERTY_APPROVED',
          title: 'Property Listing Approved!',
          message: `Your property listing "${property.title}" has been approved and is now live.`,
          metadata: { propertyId: property.id },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_APPROVED',
          entityType: 'PROPERTY',
          entityId: propertyId,
          metadata: { previousStatus: property.status, newStatus: PropertyStatus.APPROVED },
        },
      });

      return p;
    });

    return updated;
  }

  static async rejectProperty(adminId: string, propertyId: string, reason: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.REJECTED,
          rejectionReason: reason.trim(),
        },
      });

      await tx.moderationHistory.create({
        data: {
          propertyId,
          adminId,
          action: 'REJECT',
          previousStatus: property.status,
          newStatus: PropertyStatus.REJECTED,
          reason: reason.trim(),
        },
      });

      await tx.notification.create({
        data: {
          userId: property.ownerId,
          type: 'PROPERTY_REJECTED',
          title: 'Property Listing Needs Changes',
          message: `Your listing "${property.title}" was rejected: ${reason.trim()}`,
          metadata: { propertyId: property.id, reason: reason.trim() },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_REJECTED',
          entityType: 'PROPERTY',
          entityId: propertyId,
          metadata: { reason },
        },
      });

      return p;
    });

    return updated;
  }

  static async updatePropertyStatus(
    adminId: string,
    propertyId: string,
    newStatus: PropertyStatus,
    reason?: string
  ) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) throw ApiError.notFound('Property not found');

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.property.update({
        where: { id: propertyId },
        data: {
          status: newStatus,
          ...(newStatus === PropertyStatus.APPROVED && !property.publishedAt
            ? { publishedAt: new Date(), verifiedAt: new Date() }
            : {}),
          ...(reason ? { rejectionReason: reason } : {}),
        },
      });

      await tx.moderationHistory.create({
        data: {
          propertyId,
          adminId,
          action: `STATUS_CHANGE_TO_${newStatus}`,
          previousStatus: property.status,
          newStatus,
          reason: reason || 'Status modified by administrator',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_STATUS_CHANGE',
          entityType: 'PROPERTY',
          entityId: propertyId,
          metadata: { previousStatus: property.status, newStatus, reason },
        },
      });

      return p;
    });

    return updated;
  }

  static async updateProperty(adminId: string, propertyId: string, data: any) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) throw ApiError.notFound('Property not found');

    const amenityIds: string[] | undefined = Array.isArray(data.amenityIds) ? data.amenityIds : undefined;
    const images: any[] | undefined = Array.isArray(data.images) ? data.images : undefined;

    delete data.id;
    delete data.ownerId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.deletedAt;
    delete data.amenityIds;
    delete data.images;

    if (data.price !== undefined) data.price = Number(data.price);
    if (data.bedrooms !== undefined) data.bedrooms = Number(data.bedrooms);
    if (data.bathrooms !== undefined) data.bathrooms = Number(data.bathrooms);
    if (data.carpetArea !== undefined) data.carpetArea = Number(data.carpetArea);
    if (data.isFeatured !== undefined) data.isFeatured = Boolean(data.isFeatured);
    if (data.isLatest !== undefined) data.isLatest = Boolean(data.isLatest);

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
            const altText = typeof img === 'object' && img.altText ? img.altText : `${property.title} - Image ${idx + 1}`;
            const isPrimary = typeof img === 'object' && img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0;
            const storageKey = typeof img === 'object' && img.storageKey ? img.storageKey : `admin-uploads/${propertyId}-${idx}`;
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

      const p = await tx.property.update({
        where: { id: propertyId },
        data,
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          amenities: { include: { amenity: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_UPDATED',
          entityType: 'PROPERTY',
          entityId: propertyId,
          metadata: { updatedFields: Object.keys(data) },
        },
      });

      return p;
    });

    return updated;
  }

  static async deleteProperty(adminId: string, propertyId: string) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw ApiError.notFound('Property not found');

    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: { deletedAt: new Date(), status: PropertyStatus.ARCHIVED },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_DELETED',
          entityType: 'PROPERTY',
          entityId: propertyId,
          metadata: { title: property.title },
        },
      });
    });
  }

  static async createProperty(adminId: string, data: any) {
    const title = data.title;
    const city = data.city;
    const baseSlug = `${title} ${city}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;

    const status = data.status || PropertyStatus.APPROVED;
    const isApproved = status === PropertyStatus.APPROVED;

    const amenityIds: string[] = Array.isArray(data.amenityIds) ? data.amenityIds : [];
    const images: Array<string | { imageUrl: string; altText?: string }> = Array.isArray(data.images) ? data.images : [];

    delete data.amenityIds;
    delete data.images;

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          ...data,
          ownerId: data.ownerId || adminId,
          slug,
          status,
          isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : false,
          isLatest: data.isLatest !== undefined ? Boolean(data.isLatest) : false,
          verifiedAt: isApproved ? new Date() : null,
          publishedAt: isApproved ? new Date() : null,
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
        const imageRecords = images.map((img, idx) => {
          const imageUrl = typeof img === 'string' ? img : img.imageUrl;
          const altText = typeof img === 'object' && img.altText ? img.altText : `${title} - Image ${idx + 1}`;
          return {
            propertyId: created.id,
            storageKey: `admin-uploads/${created.id}-${idx}`,
            imageUrl,
            altText,
            displayOrder: idx,
            isPrimary: idx === 0,
          };
        });

        await tx.propertyImage.createMany({
          data: imageRecords,
        });
      }

      if (isApproved) {
        await tx.moderationHistory.create({
          data: {
            propertyId: created.id,
            adminId,
            action: 'CREATE_AND_APPROVE',
            previousStatus: PropertyStatus.DRAFT,
            newStatus: PropertyStatus.APPROVED,
            reason: 'Created directly and approved by administrator',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROPERTY_CREATED_BY_ADMIN',
          entityType: 'PROPERTY',
          entityId: created.id,
          metadata: {
            title: created.title,
            status: created.status,
            price: Number(created.price),
            city: created.city,
            propertyType: created.propertyType,
          },
        },
      });

      return tx.property.findUnique({
        where: { id: created.id },
        include: {
          owner: { select: { id: true, fullName: true, email: true, role: true } },
          images: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }] },
          amenities: { include: { amenity: true } },
        },
      });
    });

    return property;
  }

  static async getModerationHistory(propertyId: string) {
    return prisma.moderationHistory.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Inquiry Management
   */
  static async listInquiries(options: {
    skip: number;
    take: number;
    search?: string;
    status?: InquiryStatus;
    city?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { skip, take, search, status, city, from, to, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const where: any = {
      ...(status ? { inquiryStatus: status } : {}),
      ...(city ? { property: { city: { contains: city.trim(), mode: 'insensitive' } } } : {}),
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { property: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'inquiryStatus'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [total, inquiries] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        skip,
        take,
        orderBy: { [validSortBy]: sortOrder },
        include: {
          property: {
            select: { id: true, title: true, city: true, price: true, listingType: true },
          },
          buyer: { select: { id: true, fullName: true, email: true, phone: true } },
          owner: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      }),
    ]);

    return { total, inquiries };
  }

  static async getInquiryById(inquiryId: string) {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        property: {
          include: {
            images: { take: 1, select: { imageUrl: true } },
          },
        },
        buyer: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
        owner: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
      },
    });

    if (!inquiry) throw ApiError.notFound('Inquiry not found');
    return inquiry;
  }

  static async updateInquiryStatus(adminId: string, inquiryId: string, newStatus: InquiryStatus) {
    const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw ApiError.notFound('Inquiry not found');

    const updated = await prisma.$transaction(async (tx) => {
      const i = await tx.inquiry.update({
        where: { id: inquiryId },
        data: { inquiryStatus: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'INQUIRY_STATUS_CHANGE',
          entityType: 'INQUIRY',
          entityId: inquiryId,
          metadata: { previousStatus: inquiry.inquiryStatus, newStatus },
        },
      });

      return i;
    });

    return updated;
  }

  /**
   * Reports & Analytics
   */
  static async getUserReports() {
    const [byRole, byStatus, total] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ['accountStatus'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    // Monthly registrations for last 12 months
    const allUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { createdAt: true },
    });

    const monthlyMap = new Map<string, number>();
    for (const u of allUsers) {
      const monthKey = u.createdAt.toISOString().slice(0, 7); // YYYY-MM
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
    }

    const monthlyGrowth = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.accountStatus, count: s._count.id })),
      monthlyGrowth,
    };
  }

  static async getPropertyReports() {
    const [byType, byListing, byCity, byStatus, total] = await Promise.all([
      prisma.property.groupBy({
        by: ['propertyType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ['listingType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ['city'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.property.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.count({ where: { deletedAt: null } }),
    ]);

    const allProps = await prisma.property.findMany({
      where: { deletedAt: null },
      select: { createdAt: true },
    });

    const monthlyMap = new Map<string, number>();
    for (const p of allProps) {
      const monthKey = p.createdAt.toISOString().slice(0, 7);
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
    }

    const monthlyGrowth = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total,
      byType: byType.map((t) => ({ type: t.propertyType, count: t._count.id })),
      byListingType: byListing.map((l) => ({ type: l.listingType, count: l._count.id })),
      byCity: byCity.map((c) => ({ city: c.city, count: c._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      monthlyGrowth,
    };
  }

  static async getCategoryStats() {
    const dbCategories = await prisma.propertyCategory.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    const [counts, approvedCounts, amenities] = await Promise.all([
      prisma.property.groupBy({
        by: ['propertyType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ['propertyType'],
        where: { deletedAt: null, status: PropertyStatus.APPROVED },
        _count: { id: true },
      }),
      prisma.amenity.findMany({
        include: {
          _count: {
            select: { properties: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const countMap: Record<string, { total: number; approved: number }> = {};
    counts.forEach((c) => {
      countMap[c.propertyType] = { total: c._count.id, approved: 0 };
    });
    approvedCounts.forEach((c) => {
      if (countMap[c.propertyType]) {
        countMap[c.propertyType].approved = c._count.id;
      }
    });

    const categories = dbCategories.map((cat) => ({
      id: cat.id,
      type: cat.type,
      name: cat.name,
      description: cat.description,
      imageUrl: cat.imageUrl || null,
      isActive: cat.isActive,
      totalProperties: countMap[cat.type]?.total || 0,
      approvedProperties: countMap[cat.type]?.approved || 0,
    }));

    return {
      categories,
      amenities: amenities.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        icon: a.icon,
        imageUrl: (a as any).imageUrl || null,
        createdAt: a.createdAt,
        usageCount: a._count.properties,
      })),
    };
  }

  static async createCategory(data: { name: string; type?: string; imageUrl?: string; description?: string }) {
    const { name, imageUrl, description } = data;
    if (!name || !name.trim()) throw ApiError.badRequest('Category name is required');

    const cleanType = (data.type || name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const existing = await prisma.propertyCategory.findFirst({
      where: { OR: [{ type: cleanType }, { name: name.trim() }] },
    });
    if (existing) throw ApiError.conflict('A category with this name or type identifier already exists');

    return prisma.propertyCategory.create({
      data: {
        type: cleanType,
        name: name.trim(),
        imageUrl: imageUrl?.trim() || null,
        description: description?.trim() || null,
      },
    });
  }

  static async updateCategory(id: string, data: { name?: string; imageUrl?: string; description?: string; isActive?: boolean }) {
    const existing = await prisma.propertyCategory.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Category not found');

    return prisma.propertyCategory.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });
  }

  static async deleteCategory(id: string) {
    const existing = await prisma.propertyCategory.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Category not found');

    await prisma.propertyCategory.delete({ where: { id } });
    return null;
  }

  static async getInquiryReports() {
    const [byStatus, total] = await Promise.all([
      prisma.inquiry.groupBy({
        by: ['inquiryStatus'],
        _count: { id: true },
      }),
      prisma.inquiry.count(),
    ]);

    const allInquiries = await prisma.inquiry.findMany({
      select: { createdAt: true },
    });

    const monthlyMap = new Map<string, number>();
    for (const inq of allInquiries) {
      const monthKey = inq.createdAt.toISOString().slice(0, 7);
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
    }

    const monthlyGrowth = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.inquiryStatus, count: s._count.id })),
      monthlyGrowth,
    };
  }

  static async getAnalytics() {
    const [byType, byListing, byCity] = await Promise.all([
      prisma.property.groupBy({
        by: ['propertyType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ['listingType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.property.groupBy({
        by: ['city'],
        where: { status: PropertyStatus.APPROVED, deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      propertiesByType: byType.map((t) => ({ type: t.propertyType, count: t._count.id })),
      propertiesByListingType: byListing.map((l) => ({ type: l.listingType, count: l._count.id })),
      topCities: byCity.map((c) => ({ city: c.city, count: c._count.id })),
    };
  }

  /**
   * Audit Logs
   */
  static async getAuditLogs(options: {
    skip: number;
    take: number;
    search?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    from?: string;
    to?: string;
  }) {
    const { skip, take, search, action, entityType, actorId, from, to } = options;

    const where: any = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { actor: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
    ]);

    return { total, logs };
  }

  static async getAuditLogById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    if (!log) throw ApiError.notFound('Audit log record not found');
    return log;
  }

  /**
   * Admin Profile & Settings
   */
  static async updateAdminProfile(adminId: string, data: { fullName?: string; phone?: string | null; profileImage?: string | null }) {
    const updated = await prisma.user.update({
      where: { id: adminId },
      data: {
        ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.profileImage !== undefined ? { profileImage: data.profileImage } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        profileImage: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_PROFILE_UPDATE',
        entityType: 'USER',
        entityId: adminId,
        metadata: { updatedFields: Object.keys(data) },
      },
    });

    return updated;
  }

  static async changeAdminPassword(adminId: string, currentPass: string, newPass: string) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw ApiError.notFound('Admin user not found');

    const isMatch = await bcrypt.compare(currentPass, admin.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password does not match');
    }

    const newHash = await bcrypt.hash(newPass, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: adminId },
        data: { passwordHash: newHash },
      });

      // Revoke old sessions
      await tx.refreshSession.updateMany({
        where: { userId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_PASSWORD_CHANGE',
          entityType: 'USER',
          entityId: adminId,
        },
      });
    });
  }
}
