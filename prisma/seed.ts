import { PrismaClient, UserRole, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUPERADMIN_ROLE = 'SUPERADMIN' as UserRole;

/** Ensure DB enums match schema (safe if migrations were skipped or failed mid-way). */
async function ensureStaffEnums() {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'APPROVER'`,
  );
}

async function findSuperAdmin() {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE role::text = 'SUPERADMIN' LIMIT 1
  `;
  return rows[0] ?? null;
}

async function main() {
  console.log('🌱 Starting database seeding...');

  await ensureStaffEnums();

  const existingSuperAdmin = await findSuperAdmin();

  if (existingSuperAdmin) {
    console.log('✅ Super admin already exists. Skipping seed.');
    console.log(`🆔 User ID: ${existingSuperAdmin.id}`);
    return;
  }

  const superAdminEmail =
    process.env.SUPERADMIN_EMAIL || 'superadmin@leviateapp.com';
  const superAdminPassword =
    process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';

  const existingUser = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (existingUser) {
    if (existingUser.role === UserRole.SUPERADMIN) {
      console.log('✅ Super admin already exists for this email. Skipping seed.');
      return;
    }
    console.log(
      `⚠️  User ${superAdminEmail} exists with role ${existingUser.role}. Promoting to SUPERADMIN + APPROVER...`,
    );
    const passwordHash = await bcrypt.hash(superAdminPassword, 12);
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: SUPERADMIN_ROLE as UserRole,
        userType: UserType.APPROVER,
        emailVerified: true,
        profileComplete: true,
        passwordHash,
        status: 'ACTIVE',
        reputationScore: 100,
      },
    });
    console.log('✅ Existing user promoted to super admin.');
    console.log(`📧 Email: ${superAdminEmail}`);
    console.log(`🔑 Password: ${superAdminPassword} (reset)`);
    console.log(`🆔 User ID: ${updated.id}`);
    return;
  }

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);
  const referralCode = generateReferralCode();
  const socialVerificationCode = generateSocialVerificationCode();

  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash,
      role: SUPERADMIN_ROLE as UserRole,
      userType: UserType.APPROVER,
      emailVerified: true,
      profileComplete: true,
      referralCode,
      socialVerificationCode,
      reputationScore: 100,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Super admin created successfully!');
  console.log(`📧 Email: ${superAdminEmail}`);
  console.log(`🔑 Password: ${superAdminPassword}`);
  console.log(`🆔 User ID: ${superAdmin.id}`);
  console.log(
    '\n⚠️  IMPORTANT: Change the default password after first login!',
  );
  console.log(
    '\n💡 Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env before seeding.',
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

function generateSocialVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LV-${body}`;
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
