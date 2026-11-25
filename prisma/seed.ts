import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Starting clean database initialization...');

  // 1. Clean existing dummy records safely
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.moderationHistory.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.propertyAmenity.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.propertyImage.deleteMany();
  await prisma.property.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.user.deleteMany();

  console.info('🧹 Cleaned existing database records.');

  // 2. Hash administrator password
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'AdminSecurePass@2026', 10);

  // 3. Create Super Admin User (Clean setup, no dummy users)
  const superAdmin = await prisma.user.create({
    data: {
      fullName: process.env.ADMIN_NAME || 'Platform Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@realestateplatform.com',
      phone: '+919876543210',
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  console.info(`👤 Initialized SuperAdmin: ${superAdmin.email}`);

  // 4. Create Standard Amenities (Names and Icons only, no dummy URLs)
  const amenityData = [
    { name: 'Swimming Pool', slug: 'swimming-pool', icon: 'pool' },
    { name: 'Gymnasium', slug: 'gymnasium', icon: 'fitness' },
    { name: 'Lift / Elevator', slug: 'lift-elevator', icon: 'elevator' },
    { name: 'Power Backup', slug: 'power-backup', icon: 'bolt' },
    { name: '24/7 Security & CCTV', slug: 'security-cctv', icon: 'shield' },
    { name: 'Covered Car Parking', slug: 'car-parking', icon: 'local_parking' },
    { name: 'Club House', slug: 'club-house', icon: 'groups' },
    { name: 'Children Play Area', slug: 'play-area', icon: 'child_friendly' },
    { name: 'Piped Gas', slug: 'piped-gas', icon: 'gas_meter' },
    { name: 'Rainwater Harvesting', slug: 'rainwater-harvesting', icon: 'water_drop' },
  ];

  const amenities = await Promise.all(
    amenityData.map((a) => prisma.amenity.create({ data: a }))
  );
  console.info(`✨ Created ${amenities.length} base amenities.`);
  console.info('✅ Clean database setup completed successfully (zero dummy listings, zero dummy users).');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
