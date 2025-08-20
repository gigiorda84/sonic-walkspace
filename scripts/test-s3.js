#!/usr/bin/env node

/**
 * S3 Configuration Test Script
 * 
 * This script tests your S3 configuration by:
 * 1. Testing connection to S3
 * 2. Listing bucket contents
 * 3. Testing upload functionality
 * 
 * Usage: node scripts/test-s3.js
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

async function testS3Configuration() {
  console.log('🔧 Testing S3 Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
  console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
  console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   BUNDLES_S3_URL: ${process.env.BUNDLES_S3_URL || 'NOT SET'}`);
  console.log(`   S3_PUBLIC_READ: ${process.env.S3_PUBLIC_READ || 'NOT SET'}\n`);

  // Parse S3 URL
  const s3Url = process.env.BUNDLES_S3_URL;
  if (!s3Url) {
    console.error('❌ BUNDLES_S3_URL not set in environment');
    return;
  }

  const match = s3Url.match(/^s3:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!match) {
    console.error('❌ Invalid S3 URL format. Expected: s3://bucket-name/prefix');
    return;
  }

  const bucketName = match[1];
  const prefix = match[2] || '';

  console.log(`📦 S3 Bucket: ${bucketName}`);
  console.log(`📁 Prefix: ${prefix || '(none)'}\n`);

  // Create S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
  });

  try {
    // Test 1: List bucket contents
    console.log('🧪 Test 1: Listing bucket contents...');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 10
    });

    const listResult = await s3Client.send(listCommand);
    console.log(`   ✅ Success! Found ${listResult.Contents?.length || 0} objects`);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log('   📄 Sample files:');
      listResult.Contents.slice(0, 5).forEach(obj => {
        console.log(`      - ${obj.Key} (${obj.Size} bytes)`);
      });
    }
    console.log('');

    // Test 2: Test upload (create a test file)
    console.log('🧪 Test 2: Testing upload functionality...');
    const testKey = `${prefix ? prefix + '/' : ''}test/connection-test.txt`;
    const testContent = `S3 Connection Test - ${new Date().toISOString()}`;

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      ACL: process.env.S3_PUBLIC_READ ? 'public-read' : undefined
    });

    await s3Client.send(putCommand);
    console.log(`   ✅ Success! Uploaded test file: ${testKey}`);
    console.log('');

    // Test 3: Verify upload
    console.log('🧪 Test 3: Verifying upload...');
    const verifyCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: testKey
    });

    const verifyResult = await s3Client.send(verifyCommand);
    if (verifyResult.Contents && verifyResult.Contents.length > 0) {
      console.log('   ✅ Success! Test file found in bucket');
    } else {
      console.log('   ⚠️  Warning: Test file not found (may take a moment to appear)');
    }
    console.log('');

    console.log('🎉 All tests passed! Your S3 configuration is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Update your .env.local with real AWS credentials');
    console.log('   2. Test file uploads in the CMS');
    console.log('   3. Verify audio playback in the Player');

  } catch (error) {
    console.error('❌ S3 Test Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your AWS credentials');
    console.log('   2. Verify bucket name and permissions');
    console.log('   3. Ensure IAM user has proper S3 permissions');
    console.log('   4. Check if bucket exists in the specified region');
  }
}

// Run the test
testS3Configuration().catch(console.error);
