import { PrismaClient, Role, AccountStatus, PropertyStatus, PropertyType, ListingType } from '@prisma/client';
import bcrypt from 'bcrypt';
import { TokenService } from '../../src/services/security/tokenService.js';

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/real_estate_test_db?schema=public',
    },
  },
});

export async function clearTestDatabase() {
  await testPrisma.notification.deleteMany();
  await testPrisma.auditLog.deleteMany();
  await testPrisma.moderationHistory.deleteMany();
  await testPrisma.inquiry.deleteMany();
  await testPrisma.favorite.deleteMany();
  await testPrisma.propertyAmenity.deleteMany();
  await testPrisma.amenity.deleteMany();
  await testPrisma.propertyImage.deleteMany();
  await testPrisma.property.deleteMany();
  await testPrisma.passwordResetToken.deleteMany();
  await testPrisma.refreshSession.deleteMany();
  await testPrisma.user.deleteMany();
}

export async function seedTestUsers() {
  const passwordHash = await bcrypt.hash('TestPass@123', 10);

  const admin = await testPrisma.user.create({
    data: {
      fullName: 'Test Admin',
      email: 'admin.test@example.com',
      passwordHash,
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const agent = await testPrisma.user.create({
    data: {
      fullName: 'Test Agent',
      email: 'agent.test@example.com',
      passwordHash,
      role: Role.AGENT,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const buyer = await testPrisma.user.create({
    data: {
      fullName: 'Test Buyer',
      email: 'buyer.test@example.com',
      passwordHash,
      role: Role.USER,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const adminToken = TokenService.signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    fullName: admin.fullName,
    accountStatus: admin.accountStatus,
  });

  const agentToken = TokenService.signAccessToken({
    sub: agent.id,
    email: agent.email,
    role: agent.role,
    fullName: agent.fullName,
    accountStatus: agent.accountStatus,
  });

  const buyerToken = TokenService.signAccessToken({
    sub: buyer.id,
    email: buyer.email,
    role: buyer.role,
    fullName: buyer.fullName,
    accountStatus: buyer.accountStatus,
  });

  return {
    admin,
    agent,
    buyer,
    adminToken,
    agentToken,
    buyerToken,
  };
}

