import request from 'supertest';
import { createApp } from '../../src/app.js';
import { testPrisma, clearTestDatabase, seedTestUsers } from '../helpers/testDb.js';
import { PropertyType, ListingType, PropertyStatus, Role } from '@prisma/client';

describe('Security & Authorization Tests', () => {
  const app = createApp();
  let testUsers: Awaited<ReturnType<typeof seedTestUsers>>;

  beforeAll(async () => {
    await clearTestDatabase();
    testUsers = await seedTestUsers();
  });

  afterAll(async () => {
    await clearTestDatabase();
    await testPrisma.$disconnect();
  });

  describe('Authentication Enforcement', () => {
    it('Protected routes should reject requests without token with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Protected routes should reject malformed or fake JWT with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_tampered_jwt_string_1234');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid access token');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('Regular user or agent should be denied access to Admin Dashboard with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${testUsers.buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Permission denied');
    });

    it('Admin can access Admin Dashboard with 200', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toBeDefined();
    });

    it('Standard Admin cannot change user role to SUPER_ADMIN (requires SUPER_ADMIN)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testUsers.buyer.id}/role`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`)
        .send({ role: Role.SUPER_ADMIN });

      expect(res.status).toBe(403);
    });
  });

  describe('IDOR & Ownership Controls', () => {
    let agentPropertyId: string;

    beforeAll(async () => {
      const prop = await testPrisma.property.create({
        data: {
          ownerId: testUsers.agent.id,
          title: 'Agent Private Property',
          slug: 'agent-private-property-test-123',
          description: 'Testing private property ownership verification',
          propertyType: PropertyType.APARTMENT,
          listingType: ListingType.SALE,
          price: 5000000,
          carpetArea: 800,
          city: 'Pune',
          locality: 'Kothrud',
          state: 'Maharashtra',
          postalCode: '411038',
          address: 'Main Road',
          status: PropertyStatus.DRAFT,
        },
      });
      agentPropertyId = prop.id;
    });

    it('Non-owner cannot update or tamper with another user property', async () => {
      const res = await request(app)
        .patch(`/api/v1/properties/${agentPropertyId}`)
        .set('Authorization', `Bearer ${testUsers.buyerToken}`)
        .send({ title: 'Hacked Title Overwrite Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not authorized');
    });

    it('Non-owner cannot delete another user property', async () => {
      const res = await request(app)
        .delete(`/api/v1/properties/${agentPropertyId}`)
        .set('Authorization', `Bearer ${testUsers.buyerToken}`);

      expect(res.status).toBe(403);
    });

    it('Owner can update their own property', async () => {
      const res = await request(app)
        .patch(`/api/v1/properties/${agentPropertyId}`)
        .set('Authorization', `Bearer ${testUsers.agentToken}`)
        .send({ title: 'Updated Legitimate Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Legitimate Title');
    });
  });
});

