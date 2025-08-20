#!/bin/bash

# S3 Setup Script for Sonic Walkscape
# This script helps you configure S3 for your project

echo "🚀 Sonic Walkscape S3 Setup"
echo "============================"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your S3 configuration."
    exit 1
fi

echo "📋 Current S3 Configuration:"
echo ""

# Read and display current config
if command -v grep &> /dev/null; then
    echo "BUNDLES_S3_URL: $(grep 'BUNDLES_S3_URL' .env.local | cut -d'=' -f2 || echo 'NOT SET')"
    echo "AWS_REGION: $(grep 'AWS_REGION' .env.local | cut -d'=' -f2 || echo 'NOT SET')"
    echo "AWS_ACCESS_KEY_ID: $(grep 'AWS_ACCESS_KEY_ID' .env.local | cut -d'=' -f2 | sed 's/.*/***SET***/' || echo 'NOT SET')"
    echo "AWS_SECRET_ACCESS_KEY: $(grep 'AWS_SECRET_ACCESS_KEY' .env.local | cut -d'=' -f2 | sed 's/.*/***SET***/' || echo 'NOT SET')"
    echo "S3_PUBLIC_READ: $(grep 'S3_PUBLIC_READ' .env.local | cut -d'=' -f2 || echo 'NOT SET')"
else
    echo "grep not available, cannot read .env.local"
fi

echo ""
echo "🔧 Setup Steps:"
echo "1. Create S3 bucket in AWS Console"
echo "2. Configure IAM user with S3 permissions"
echo "3. Update .env.local with your credentials"
echo "4. Test configuration with: npm run test:s3"
echo "5. Check status in CMS with ☁️ S3 Status button"
echo ""

echo "📚 Documentation:"
echo "- S3 Configuration Guide: S3_CONFIGURATION.md"
echo "- AWS S3 Console: https://console.aws.amazon.com/s3/"
echo "- AWS IAM Console: https://console.aws.amazon.com/iam/"
echo ""

echo "🧪 Test Commands:"
echo "npm run test:s3          # Test S3 configuration"
echo "curl /api/s3/status      # Check S3 status via API"
echo ""

echo "✅ Setup complete! Follow the steps above to configure S3."
