import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { PropertyStatus } from '@prisma/client';

export class LocationController {
  static async searchLocations(req: Request, res: Response) {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!query || query.length < 2) {
      // Return top cities with active listing counts
      const topCities = await prisma.property.groupBy({
        by: ['city', 'state'],
        where: { status: PropertyStatus.APPROVED, deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      return ApiResponse.success(
        res,
        topCities.map((c) => ({
          city: c.city,
          state: c.state,
          propertyCount: c._count.id,
        })),
        'Top locations retrieved'
      );
    }

    // Fast indexed grouping for matching cities and localities
    const [matchingCities, matchingLocalities] = await Promise.all([
      prisma.property.groupBy({
        by: ['city', 'state'],
        where: {
          city: { contains: query, mode: 'insensitive' },
          status: PropertyStatus.APPROVED,
          deletedAt: null,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.property.groupBy({
        by: ['locality', 'city', 'state'],
        where: {
          locality: { contains: query, mode: 'insensitive' },
          status: PropertyStatus.APPROVED,
          deletedAt: null,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const results = [
      ...matchingCities.map((c) => ({
        type: 'CITY',
        name: c.city,
        state: c.state,
        count: c._count.id,
      })),
      ...matchingLocalities.map((l) => ({
        type: 'LOCALITY',
        name: `${l.locality}, ${l.city}`,
        locality: l.locality,
        city: l.city,
        state: l.state,
        count: l._count.id,
      })),
    ];

    return ApiResponse.success(res, results, 'Location search results');
  }
}
