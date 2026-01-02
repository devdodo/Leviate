/**
 * Create the elevare database if it doesn't exist
 * Run with: node create-database.js
 */

const { PrismaClient } = require('@prisma/client');

// Connect to default 'postgres' database first
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL?.replace(/\/elevare(\?|$)/, '/postgres$1') || 'postgresql://user:pass@localhost:5432/postgres',
    },
  },
});

async function createDatabase() {
  console.log('🔍 Checking database connection...\n');

  try {
    // Test connection to postgres database
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Connected to PostgreSQL server\n');

    // Check if elevare database exists
    console.log('📊 Checking if database "elevare" exists...\n');
    
    const databases = await prisma.$queryRaw`
      SELECT datname FROM pg_database WHERE datname = 'elevare'
    `;

    if (databases.length > 0) {
      console.log('✅ Database "elevare" already exists!\n');
      console.log('You can now run: npx prisma migrate dev');
    } else {
      console.log('📝 Database "elevare" does not exist. Creating it...\n');
      
      // Create the database
      await prisma.$executeRawUnsafe(`CREATE DATABASE elevare`);
      
      console.log('✅ Database "elevare" created successfully!\n');
      console.log('Next steps:');
      console.log('1. Update your .env file to use the "elevare" database');
      console.log('2. Run: npx prisma migrate dev --name init');
    }

  } catch (error) {
    console.error('\n❌ Error:\n');
    console.error(error.message);
    
    if (error.message.includes('permission denied')) {
      console.error('\n⚠️  Permission denied. You may need to:');
      console.error('1. Connect as a superuser');
      console.error('2. Or create the database manually in AWS RDS Console');
      console.error('3. Or use a user with CREATEDB privilege');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDatabase();

