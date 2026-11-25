import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { PropertyStatus, InquiryStatus, Role } from '@prisma/client';

export class InquiryService {
  static async createInquiry(
    propertyId: string,
    buyerId: string | undefined,
    data: { name: string; email: string; phone: string; message: string; source?: string }
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true, title: true, status: true, deletedAt: true },
    });

    if (!property || property.deletedAt) {
      throw ApiError.notFound('Property not found');
    }

    if (property.status !== PropertyStatus.APPROVED) {
      throw ApiError.badRequest('Cannot inquire on an unapproved or unavailable property');
    }

    // Prevent property owner from inquiring on their own listing
    if (buyerId && property.ownerId === buyerId) {
      throw ApiError.badRequest('You cannot send an inquiry on your own property listing');
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // SPAM / DUPLICATE DETECTION WINDOW:
    // Disallow identical inquiry from same email for same property within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentDuplicate = await prisma.inquiry.findFirst({
      where: {
        propertyId,
        email: normalizedEmail,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentDuplicate) {
      throw ApiError.tooManyRequests(
        'You have recently sent an inquiry for this property. Please wait a few minutes before submitting another.'
      );
    }

    const inquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        data: {
          propertyId,
          ownerId: property.ownerId,
          buyerId: buyerId || null,
          name: data.name.trim(),
          email: normalizedEmail,
          phone: data.phone.trim(),
          message: data.message.trim(),
          source: data.source || 'WEBSITE',
          inquiryStatus: InquiryStatus.NEW,
        },
      });

      // Deliver Notification to Property Owner
      await tx.notification.create({
        data: {
          userId: property.ownerId,
          type: 'INQUIRY_RECEIVED',
          title: `New Inquiry for "${property.title}"`,
          message: `${data.name} sent an inquiry regarding your property: "${data.message.slice(0, 100)}..."`,
          metadata: {
            inquiryId: created.id,
            propertyId: property.id,
            buyerEmail: normalizedEmail,
            buyerPhone: data.phone,
          },
        },
      });

      return created;
    });

    return inquiry;
  }

  static async createContactInquiry(
    buyerId: string | undefined,
    data: { name: string; email: string; phone: string; subject?: string; message: string }
  ) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentDuplicate = await prisma.inquiry.findFirst({
      where: {
        propertyId: null,
        source: 'CONTACT_US',
        email: normalizedEmail,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentDuplicate) {
      throw ApiError.tooManyRequests(
        'You have recently submitted a contact message. Please wait a few minutes before sending another.'
      );
    }

    const formattedMessage = data.subject
      ? `[${data.subject.trim()}] ${data.message.trim()}`
      : data.message.trim();

    const inquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        data: {
          propertyId: null,
          ownerId: null,
          buyerId: buyerId || null,
          name: data.name.trim(),
          email: normalizedEmail,
          phone: data.phone.trim(),
          subject: data.subject?.trim() || 'General Inquiry',
          message: formattedMessage,
          source: 'CONTACT_US',
          inquiryStatus: InquiryStatus.NEW,
        },
      });

      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'INQUIRY_RECEIVED',
            title: `New Contact Message from ${data.name.trim()}`,
            message: formattedMessage.slice(0, 140),
            metadata: {
              inquiryId: created.id,
              source: 'CONTACT_US',
              buyerEmail: normalizedEmail,
              buyerPhone: data.phone.trim(),
            },
          })),
        });
      }

      return created;
    });

    return inquiry;
  }

  static async getInquiriesSentByBuyer(buyerId: string, skip: number, take: number) {
    const where = { buyerId };
    const [total, inquiries] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: { id: true, title: true, slug: true, city: true, locality: true, price: true },
          },
        },
      }),
    ]);
    return { total, inquiries };
  }

  static async getInquiriesReceivedByOwner(ownerId: string, skip: number, take: number) {
    const where = { ownerId };
    const [total, inquiries] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: { id: true, title: true, slug: true, city: true, locality: true },
          },
        },
      }),
    ]);
    return { total, inquiries };
  }

  static async getInquiryById(inquiryId: string, userId: string, userRole: Role) {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        property: {
          select: { id: true, title: true, slug: true, price: true, city: true },
        },
      },
    });

    if (!inquiry) {
      throw ApiError.notFound('Inquiry not found');
    }

    const isBuyer = inquiry.buyerId === userId;
    const isOwner = inquiry.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (!isBuyer && !isOwner && !isAdmin) {
      throw ApiError.forbidden('You are not authorized to view this inquiry');
    }

    return inquiry;
  }

  static async updateInquiryStatus(inquiryId: string, userId: string, userRole: Role, status: InquiryStatus) {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw ApiError.notFound('Inquiry not found');
    }

    const isOwner = inquiry.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('Only the property owner or administrator can update inquiry status');
    }

    const updated = await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { inquiryStatus: status },
    });

    return updated;
  }
}

