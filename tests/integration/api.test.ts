import request from 'supertest';
import { createApp } from '../../src/app.js';
import { testPrisma, clearTestDatabase, seedTestUsers } from '../helpers/testDb.js';
import { PropertyType, ListingType, PropertyStatus } from '@prisma/client';

describe('Integration Tests: API Endpoints', () => {
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

  describe('Health API', () => {
    it('GET /api/v1/health should return 200 with database health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.database.status).toBe('healthy');
    });
  });

  describe('Authentication & User Flow', () => {
    it('POST /api/v1/auth/register should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Siddharth Roy',
          email: 'siddharth@example.com',
          password: 'SecurePassword@2026',
          confirmPassword: 'SecurePassword@2026',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('siddharth@example.com');
      expect(res.body.data.role).toBe('USER');
    });

    it('POST /api/v1/auth/register should fail on duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Duplicate User',
          email: 'siddharth@example.com',
          password: 'SecurePassword@2026',
          confirmPassword: 'SecurePassword@2026',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/auth/login should authenticate user and set refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'siddharth@example.com',
          password: 'SecurePassword@2026',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('GET /api/v1/auth/me should return authenticated profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testUsers.agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testUsers.agent.email);
    });
  });

  describe('Property Management & Moderation Flow', () => {
    let createdPropertyId: string;

    it('POST /api/v1/properties should create a new listing in DRAFT status', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${testUsers.agentToken}`)
        .send({
          title: 'Stunning 3 BHK Penthouse in Whitefield',
          description: 'Spacious penthouse with private terrace and modern amenities throughout.',
          propertyType: PropertyType.APARTMENT,
          listingType: ListingType.SALE,
          price: 24000000,
          carpetArea: 2200,
          bedrooms: 3,
          bathrooms: 3,
          city: 'Bengaluru',
          locality: 'Whitefield',
          state: 'Karnataka',
          postalCode: '560066',
          address: 'Plot 45, Inner Circle Road',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(PropertyStatus.DRAFT);
      expect(res.body.data.ownerId).toBe(testUsers.agent.id);
      createdPropertyId = res.body.data.id;
    });

    it('PATCH /api/v1/properties/:id/submit-for-approval should transition property to PENDING_APPROVAL', async () => {
      const res = await request(app)
        .patch(`/api/v1/properties/${createdPropertyId}/submit-for-approval`)
        .set('Authorization', `Bearer ${testUsers.agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(PropertyStatus.PENDING_APPROVAL);
    });

    it('PATCH /api/v1/admin/properties/:id/approve should allow admin to approve property', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/properties/${createdPropertyId}/approve`)
        .set('Authorization', `Bearer ${testUsers.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(PropertyStatus.APPROVED);
      expect(res.body.data.verifiedAt).toBeDefined();
    });

    it('GET /api/v1/properties should display approved property in public search', async () => {
      const res = await request(app)
        .get('/api/v1/properties')
        .query({ city: 'Bengaluru', listingType: 'SALE' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });
  });

  describe('Favorites & Inquiries Flow', () => {
    let propertyId: string;

    beforeAll(async () => {
      const prop = await testPrisma.property.findFirst({
        where: { status: PropertyStatus.APPROVED },
      });
      propertyId = prop!.id;
    });

    it('POST /api/v1/favorites/:propertyId should add property to user favorites', async () => {
      const res = await request(app)
        .post(`/api/v1/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${testUsers.buyerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/favorites/:propertyId duplicate should return 409 conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${testUsers.buyerToken}`);

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/properties/:id/inquiries should submit an inquiry and notify owner', async () => {
      const res = await request(app)
        .post(`/api/v1/properties/${propertyId}/inquiries`)
        .send({
          name: 'Rohan Mehra',
          email: 'rohan.guest@example.com',
          phone: '+919876599999',
          message: 'Is this penthouse available for site inspection tomorrow morning?',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('Submitting identical inquiry within 5 minutes should trigger duplicate protection window', async () => {
      const res = await request(app)
        .post(`/api/v1/properties/${propertyId}/inquiries`)
        .send({
          name: 'Rohan Mehra',
          email: 'rohan.guest@example.com',
          phone: '+919876599999',
          message: 'Second quick submission',
        });

      expect(res.status).toBe(429);
      expect(res.body.message).toContain('recently sent an inquiry');
    });
  });
});

