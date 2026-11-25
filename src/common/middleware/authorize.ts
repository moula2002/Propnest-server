import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../../config/database.js';

export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User must be authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

export const requireAdmin = authorizeRoles(Role.ADMIN, Role.SUPER_ADMIN);
export const requireSuperAdmin = authorizeRoles(Role.SUPER_ADMIN);

export const requirePropertyOwnerOrAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const propertyId = String(req.params.id || req.params.propertyId);
    if (!propertyId) {
      return next(ApiError.badRequest('Property ID is required in URL parameters'));
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true, deletedAt: true },
    });

    if (!property || property.deletedAt) {
      return next(ApiError.notFound('Property not found'));
    }

    const isOwner = property.ownerId === req.user.id;
    const isAdmin = req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      return next(ApiError.forbidden('You are not authorized to modify or manage this property'));
    }

    next();
  } catch (error) {
    next(error);
  }
};
