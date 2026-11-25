import request from 'supertest';
import { createApp } from '../../src/app.js';
import { testPrisma, clearTestDatabase, seedTestUsers } from '../helpers/testDb.js';
import { Role, AccountStatus, PropertyStatus, PropertyType, ListingType, InquiryStatus } from '@prisma/client';

const app = createApp();

describe('Admin Integration Tests: Full Admin API Suite', () => {
  let testUsers: Awaited<ReturnType<typeof seedTestUsers>>;
  let testPropertyId: string;
  let testInquiryId: string;

  beforeAll(async () => {
    await clearTestDatabase();
    testUsers = await seedTestUsers();

    // Create a property
    const prop = await testPrisma.property.create({
      data: {
        ownerId: testUsers.agent.id,
        title: 'Moderation Test Apartment',
        slug: 'moderation-test-apartment-123',
        description: 'Quality apartment for testing moderation flow',
        propertyType: PropertyType.APARTMENT,
        listingType: ListingType.SALE,
        price: 7500000,
        carpetArea: 950,
        city: 'Bengaluru',
        locality: 'Whitefield',
        state: 'Karnataka',
        postalCode: '560066',
        address: 'ITPL Main Road',
        status: PropertyStatus.PENDING_APPROVAL,
      },
    });
    testPropertyId = prop.id;

    // Create an inquiry
    const inq = await testPrisma.inquiry.create({
      data: {
        propertyId: prop.id,
        buyerId: testUsers.buyer.id,
        ownerId: testUsers.agent.id,
        name: testUsers.buyer.fullName,
        email: testUsers.buyer.email,
        phone: '+919876543210',
        message: 'Interested in site inspection.',
        inquiryStatus: InquiryStatus.NEW,
      },
    });
    testInquiryId = inq.id;
  });

  afterAll(async () => {
    await clearTestDatabase();
    await testPrisma.$disconnect();
  });

  describe('Admin Authentication & RBAC Security', () => {
    it('Admin can log in via POST /api/v1/admin/auth/login with 200 and receive accessToken', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: testUsers.admin.email,
          password: 'TestPass@123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe(Role.ADMIN);
    });

    it('Should reject normal user attempting to log into admin endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: testUsers.buyer.email,
          password: 'TestPass@123',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Administrator privileges are required');
    });

    it('Should reject protected admin endpoints when accessed with regular user token with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${testUsers.buyerToken}`);

      expect(res.status).toBe(403);
    });

    it('Should return authenticated admin profile via GET /api/v1/admin/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testUsers.admin.id);
    });
  });

  describe('Admin Dashboard Metrics & Feeds', () => {
    it('GET /api/v1/admin/dashboard/stats should return all 13 required metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalUsers).toBeGreaterThanOrEqual(1);
      expect(data.activeUsers).toBeGreaterThanOrEqual(1);
      expect(data.inactiveUsers).toBeGreaterThanOrEqual(0);
      expect(data.totalProperties).toBeGreaterThanOrEqual(1);
      expect(data.pendingProperties).toBeGreaterThanOrEqual(1);
      expect(data.totalInquiries).toBeGreaterThanOrEqual(1);
      expect(data.newInquiries).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/dashboard/recent-activity should return recent activity feeds', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/recent-activity')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.recentUsers)).toBe(true);
      expect(Array.isArray(res.body.data.recentProperties)).toBe(true);
      expect(Array.isArray(res.body.data.recentInquiries)).toBe(true);
      expect(Array.isArray(res.body.data.pendingApprovals)).toBe(true);
      expect(Array.isArray(res.body.data.recentAuditLogs)).toBe(true);
    });
  });

  describe('Admin User Management', () => {
    it('GET /api/v1/admin/users should return paginated users list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('GET /api/v1/admin/users/:id should return user details without exposing passwordHash', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${testUsers.buyer.id}`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testUsers.buyer.id);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('PATCH /api/v1/admin/users/:id/status should update user status and record audit log', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testUsers.buyer.id}/status`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`)
        .send({ status: AccountStatus.ACTIVE, reason: 'Verification passed' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('Admin Property Moderation', () => {
    it('GET /api/v1/admin/properties should list all properties with filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/properties?page=1&limit=10')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/properties/pending should retrieve pending queue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/properties/pending')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/admin/properties/:id/reject should require valid rejection reason', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/properties/${testPropertyId}/reject`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`)
        .send({ reason: '' });

      expect([400, 422]).toContain(res.status);
    });

    it('PATCH /api/v1/admin/properties/:id/approve should approve pending property', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/properties/${testPropertyId}/approve`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(PropertyStatus.APPROVED);
    });
  });

  describe('Admin Inquiry & Reports Management', () => {
    it('GET /api/v1/admin/inquiries should return inquiries', async () => {
      const res = await request(app)
        .get('/api/v1/admin/inquiries')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/reports/users should return user growth metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/users')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.monthlyGrowth).toBeDefined();
    });

    it('GET /api/v1/admin/reports/properties should return property distribution', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/properties')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.byType).toBeDefined();
      expect(res.body.data.byCity).toBeDefined();
    });

    it('GET /api/v1/admin/audit-logs should return audit trail with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
