import { PrismaClient, UserRole, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Type assertion for SUPERADMIN (until Prisma client is regenerated)
const SUPERADMIN_ROLE = 'SUPERADMIN' as UserRole;

async function main() {
  console.log('🌱 Starting database seeding...');

  // Check if super admin already exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: SUPERADMIN_ROLE as any },
  });

  if (existingSuperAdmin) {
    console.log('✅ Super admin already exists. Skipping seed.');
    return;
  }

  // Get super admin credentials from environment
  const superAdminEmail =
    process.env.SUPERADMIN_EMAIL || 'superadmin@leviateapp.com';
  const superAdminPassword =
    process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (existingUser) {
    console.log(
      `⚠️  User with email ${superAdminEmail} already exists. Please use a different email or delete the existing user.`,
    );
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  // Generate unique referral code
  const referralCode = generateReferralCode();

  // Create super admin
  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash,
      role: SUPERADMIN_ROLE as any,
      userType: UserType.CREATOR, // Super admin can be either type
      emailVerified: true,
      profileComplete: true,
      referralCode,
      reputationScore: 100,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Super admin created successfully!');
  console.log(`📧 Email: ${superAdminEmail}`);
  console.log(`🔑 Password: ${superAdminPassword}`);
  console.log(`🆔 User ID: ${superAdmin.id}`);
  console.log(
    '\n⚠️  IMPORTANT: Please change the default password after first login!',
  );
  console.log(
    '\n💡 To customize the super admin credentials, set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in your .env file.',
  );
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

