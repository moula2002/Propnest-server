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

  // 5. Create Standard Property Categories in PostgreSQL Database
  const categoryData = [
    {
      type: 'APARTMENT',
      name: 'Apartment / Flat',
      description: 'Modern high-rise and gated community apartments with world-class amenities.',
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      displayOrder: 1,
      isActive: true,
    },
    {
      type: 'VILLA',
      name: 'Luxury Villa',
      description: 'Standalone luxury villas and private bungalows in prime residential enclaves.',
      imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
      displayOrder: 2,
      isActive: true,
    },
    {
      type: 'HOUSE',
      name: 'Independent House',
      description: 'Independent individual homes with private yards and custom architecture.',
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      displayOrder: 3,
      isActive: true,
    },
    {
      type: 'PLOT',
      name: 'Residential Plot / Land',
      description: 'Clear title residential and gated layout plots ready for construction.',
      imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
      displayOrder: 4,
      isActive: true,
    },
    {
      type: 'COMMERCIAL',
      name: 'Commercial Space',
      description: 'High footfall commercial properties, business parks, and corporate hubs.',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
      displayOrder: 5,
      isActive: true,
    },
    {
      type: 'OFFICE',
      name: 'Office Space',
      description: 'Fully furnished, grade-A tech parks and shared corporate offices.',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      displayOrder: 6,
      isActive: true,
    },
    {
      type: 'PENTHOUSE',
      name: 'Penthouse',
      description: 'Exclusive top-floor residences with panoramic skyline and ocean views.',
      imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      displayOrder: 7,
      isActive: true,
    },
    {
      type: 'SHOP',
      name: 'Retail Shop',
      description: 'Prime ground-floor retail shops and showroom spaces for businesses.',
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
      displayOrder: 8,
      isActive: true,
    },
  ];

  await prisma.propertyCategory.deleteMany();
  const categories = await Promise.all(
    categoryData.map((cat) => prisma.propertyCategory.create({ data: cat }))
  );
  console.info(`🏢 Created ${categories.length} database property categories.`);

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
