/**
 * Quick database connection test script
 * Run with: node test-db-connection.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  console.log('Connection string (without password):');
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // Mask password in output
    const masked = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log(masked);
  } else {
    console.log('❌ DATABASE_URL not found in environment variables');
    console.log('Make sure you have a .env file with DATABASE_URL set');
    process.exit(1);
  }
  
  console.log('\n⏳ Attempting to connect...\n');

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Connection successful! Database is reachable.');
    console.log('\n📊 Testing database access...');
    
    // Try to list tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  Database is connected but no tables found.');
      console.log('   Run: npx prisma migrate dev');
    } else {
      console.log(`✅ Found ${tables.length} table(s) in database.`);
    }
    
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error('Error details:');
    console.error(error.message);
    
    if (error.code === 'P1001') {
      console.error('\n🔧 Troubleshooting steps:');
      console.error('1. Check if public access is enabled in RDS console');
      console.error('2. Verify security group allows port 5432 from your IP');
      console.error('3. Check if database status is "Available" (not "Modifying")');
      console.error('4. Verify DATABASE_URL is correct in .env file');
      console.error('5. Test network connectivity:');
      console.error(`   telnet ${extractHost(dbUrl)} 5432`);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function extractHost(url) {
  try {
    const match = url.match(/@([^:]+):/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

testConnection();

