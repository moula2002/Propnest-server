import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

export class NotificationController {
  static async listNotifications(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { userId: req.user!.id };

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, notifications, 'Notifications retrieved', 200, meta);
  }

  static async markAsRead(req: Request, res: Response) {
    const notificationId = String(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: req.user!.id },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return ApiResponse.success(res, updated, 'Notification marked as read');
  }

  static async markAllAsRead(req: Request, res: Response) {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });

    return ApiResponse.success(res, null, 'All notifications marked as read');
  }
}
