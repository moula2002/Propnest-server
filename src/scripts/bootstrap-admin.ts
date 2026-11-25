import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { Role, AccountStatus } from '@prisma/client';

async function bootstrapAdmin() {
  console.info('🛡️ Bootstrapping Platform Administrator...');

  const adminEmail = (env.ADMIN_EMAIL || 'admin@realestateplatform.com').toLowerCase().trim();
  const adminPassword = env.ADMIN_PASSWORD || 'AdminSecurePass@2026';
  const adminName = env.ADMIN_NAME || 'Platform Administrator';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existingAdmin) {
    console.info(`Found existing user with email ${adminEmail}. Ensuring SUPER_ADMIN role and ACTIVE status...`);
    const updated = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: Role.SUPER_ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        passwordHash, // updates password to match env
        emailVerified: true,
      },
      select: { id: true, email: true, fullName: true, role: true, accountStatus: true },
    });
    console.info('✅ Admin account updated successfully:', updated);
  } else {
    console.info(`Creating new initial Super Admin: ${adminEmail}...`);
    const newAdmin = await prisma.user.create({
      data: {
        fullName: adminName,
        email: adminEmail,
        phone: '+919876543210',
        passwordHash,
        role: Role.SUPER_ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        phoneVerified: true,
      },
      select: { id: true, email: true, fullName: true, role: true, accountStatus: true },
    });
    console.info('✅ Initial Admin account bootstrapped successfully:', newAdmin);
  }
}

bootstrapAdmin()
  .catch((err) => {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

