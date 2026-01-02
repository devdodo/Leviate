#!/usr/bin/env node

/**
 * Generate a 32-byte encryption key in base64 format
 * Usage: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto');

// Generate 32 random bytes
const key = crypto.randomBytes(32);

// Convert to base64
const base64Key = key.toString('base64');

console.log('\n✅ Generated 32-byte encryption key (base64):\n');
console.log(base64Key);
console.log('\n📝 Add this to your .env file:');
console.log(`ENCRYPTION_KEY=${base64Key}\n`);
console.log('⚠️  Keep this key secure and never commit it to version control!\n');

