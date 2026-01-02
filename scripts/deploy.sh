#!/bin/bash

# Deployment script for Leviate API
# Usage: ./deploy.sh [environment]

set -e  # Exit on error

ENVIRONMENT=${1:-production}
APP_DIR="/var/www/elevare/elevare"
LOG_DIR="/var/log/pm2"

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Navigate to app directory
cd $APP_DIR

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build application
echo "🔨 Building application..."
npm run build

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Restart PM2 process
echo "🔄 Restarting application..."
pm2 restart leviate-api

# Wait for application to start
sleep 5

# Check application status
echo "✅ Checking application status..."
pm2 status

# Show recent logs
echo "📋 Recent logs:"
pm2 logs leviate-api --lines 20 --nostream

echo "✨ Deployment complete!"

