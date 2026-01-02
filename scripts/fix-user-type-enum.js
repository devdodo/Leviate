const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixUserTypeEnum() {
  try {
    console.log('🔄 Fixing UserType enum (TASKER -> CONTRIBUTOR)...\n');

    // Step 1: Add CONTRIBUTOR to the enum
    console.log('Adding CONTRIBUTOR to UserType enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR';
    `);

    // Step 2: Update existing TASKER records to CONTRIBUTOR
    console.log('Updating existing TASKER records to CONTRIBUTOR...');
    const updateResult = await prisma.$executeRawUnsafe(`
      UPDATE "users" SET "user_type" = 'CONTRIBUTOR' WHERE "user_type" = 'TASKER';
    `);
    console.log(`Updated ${updateResult} records from TASKER to CONTRIBUTOR`);

    // Step 3: Verify the enum values
    console.log('\nVerifying enum values...');
    const enumValues = await prisma.$queryRawUnsafe(`
      SELECT unnest(enum_range(NULL::"UserType"))::text as value;
    `);
    console.log('Current UserType enum values:', enumValues.map(v => v.value));

    console.log('\n✅ UserType enum fixed successfully!\n');
    console.log('Note: The old TASKER value remains in the enum but is no longer used.');
    console.log('To completely remove it, you would need to recreate the enum type.\n');
  } catch (error) {
    console.error('❌ Error fixing UserType enum:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  CONTRIBUTOR value may already exist. Continuing...\n');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixUserTypeEnum()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

