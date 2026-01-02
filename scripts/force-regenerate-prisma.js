const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function forceRegenerate() {
  console.log('🔄 Force regenerating Prisma client...\n');

  try {
  // Try to kill any Node processes that might be locking the file
  console.log('Attempting to free locked files...');
  
  try {
    // On Windows, try to find and kill processes using the Prisma client
    execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'ignore' });
    console.log('✓ Stopped Node.js processes\n');
  } catch (error) {
    // Ignore if no processes found
    console.log('ℹ️  No Node.js processes to stop\n');
  }

  // Wait a moment for file handles to release
  console.log('Waiting for file handles to release...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Try to delete the locked directory if it exists
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma');
  if (fs.existsSync(prismaClientPath)) {
    try {
      fs.rmSync(prismaClientPath, { recursive: true, force: true });
      console.log('✓ Cleared old Prisma client cache\n');
    } catch (error) {
      console.log('⚠️  Could not clear cache (may be locked):', error.message);
      console.log('   Please manually stop your dev server and IDE, then try again.\n');
    }
  }

  // Now try to generate
  console.log('Generating Prisma client...\n');
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

    console.log('\n✅ Prisma client regenerated successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📝 Manual steps:');
    console.log('1. Stop your development server (Ctrl+C)');
    console.log('2. Close your IDE/editor');
    console.log('3. Run: npx prisma generate');
    console.log('4. Restart your IDE and server');
    process.exit(1);
  }
}

forceRegenerate();

