# Supabase Migration Guide

This guide explains how to migrate from AWS S3 to Supabase Storage for Sonic Walkscape.

## Overview

The application has been fully migrated from AWS S3 to Supabase Storage. This provides:

- **Simpler Configuration**: No AWS credentials or IAM policies needed
- **Unified Platform**: Database and storage in one place (ready for future features)
- **Better DX**: Easier local development and deployment
- **Cost Effective**: More generous free tier and predictable pricing
- **Modern APIs**: Built-in security and real-time capabilities

## What Changed

### Environment Variables

**Old (AWS S3):**
```bash
BUNDLES_S3_URL=s3://bucket-name/prefix
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_PUBLIC_READ=1
```

**New (Supabase):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
STORAGE_URL=storage://walkscape-audio/tours
```

### API Routes Updated

1. **`/api/upload/sign`** - Now uploads directly to Supabase Storage
2. **`/api/s3/status`** - Renamed internally, tests Supabase connection
3. **`/api/s3/delete`** - Now deletes from Supabase Storage (path kept for compatibility)
4. **`/api/bundles/[slug]/[locale]/manifest`** - Returns Supabase public URLs
5. **`/api/bundles/[slug]/[locale]/file`** - Returns Supabase public URLs

### Code Changes

- **CMS Upload**: Files are converted to base64 and sent to API (no more presigned URLs)
- **Storage URLs**: Changed from S3 HTTPS URLs to Supabase public URLs
- **Dependencies**: Removed `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- **New Utility**: Created `lib/supabase.ts` for Supabase client management

## Setup Instructions

### 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose organization, name, database password, region
4. Wait for project to be provisioned (~2 minutes)

### 2. Create Storage Bucket

1. In your Supabase project, go to **Storage** in the sidebar
2. Click "Create a new bucket"
3. Bucket name: `walkscape-audio` (or your preferred name)
4. Make it **Public** (so audio files can be accessed directly)
5. Click "Create bucket"

### 3. Configure Bucket Policies (Optional)

By default, public buckets allow read access. For production, you may want to set policies:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'walkscape-audio' );

-- Allow authenticated uploads (if using auth)
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'walkscape-audio' );
```

### 4. Get API Keys

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: The public anonymous key (safe to expose)
   - **service_role**: The service role key (keep secret, server-side only)

### 5. Update Environment Variables

Create or update `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Storage URL format: storage://bucket-name/path-prefix
STORAGE_URL=storage://walkscape-audio/tours

# OpenAI (unchanged)
OPENAI_API_KEY=sk-proj-...
```

### 6. Install Dependencies

```bash
npm install
```

The `@supabase/supabase-js` package should already be installed.

### 7. Test the Migration

Start the development server:

```bash
npm run dev
```

Test the storage connection:

```bash
curl http://localhost:3000/api/s3/status
```

Expected response:
```json
{
  "status": "success",
  "bucket": "walkscape-audio",
  "prefix": "tours",
  "config": {
    "supabaseUrl": "https://xxxxx.supabase.co",
    "serviceRoleKey": "SET",
    "storageUrl": "storage://walkscape-audio/tours"
  },
  "storageInfo": {
    "message": "Upload test successful - Supabase Storage is working correctly",
    "testFile": "tours/test/status-check.txt",
    "uploadedPath": "tours/test/status-check.txt"
  }
}
```

### 8. Test Upload in CMS

1. Navigate to `http://localhost:3000/cms`
2. Create or select a tour
3. Add a region with GPS coordinates
4. Upload an audio file (MP3)
5. Verify the file is uploaded to Supabase Storage
6. Check the Supabase dashboard → Storage → walkscape-audio bucket

## File Structure in Supabase Storage

```
walkscape-audio/
└── tours/
    └── {tour-slug}/
        └── {locale}/
            └── audio/
                └── {regionId}.mp3
```

Example:
```
walkscape-audio/
└── tours/
    └── bandite-demo/
        ├── it-IT/
        │   └── audio/
        │       ├── region-1.mp3
        │       └── region-2.mp3
        └── fr-FR/
            └── audio/
                └── region-1.mp3
```

## Migration from Existing S3 Data

If you have existing audio files in S3, you can migrate them:

### Option 1: Manual Migration (Small datasets)

1. Download files from S3
2. Upload them through the CMS interface
3. Update tour metadata if needed

### Option 2: Automated Migration (Large datasets)

Use the Supabase CLI or JavaScript SDK:

```javascript
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const s3 = new S3Client({ region: 'eu-north-1' });

// List and migrate files
async function migrateFile(s3Key, supabasePath) {
  // Download from S3
  const s3Object = await s3.send(new GetObjectCommand({
    Bucket: 'your-s3-bucket',
    Key: s3Key
  }));

  const buffer = await streamToBuffer(s3Object.Body);

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from('walkscape-audio')
    .upload(supabasePath, buffer, {
      contentType: 'audio/mpeg',
      upsert: true
    });

  if (error) throw error;
  console.log(`Migrated: ${s3Key} → ${supabasePath}`);
}
```

## Vercel Deployment

Update environment variables in Vercel:

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Remove old AWS variables:
   - `BUNDLES_S3_URL`
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_READ`

3. Add new Supabase variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STORAGE_URL`

4. Redeploy your application

## Troubleshooting

### "STORAGE_URL not configured"

Make sure `.env.local` contains:
```bash
STORAGE_URL=storage://walkscape-audio/tours
```

### "Bucket not found"

1. Verify the bucket exists in Supabase dashboard
2. Check the bucket name matches your `STORAGE_URL`
3. Ensure the bucket is marked as **Public**

### Upload fails with "Storage test failed"

1. Check your `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Verify the service role has storage permissions
3. Check bucket policies allow uploads

### Files upload but can't be accessed

1. Ensure the bucket is set to **Public**
2. Check CORS settings in Supabase Storage
3. Verify the public URL format is correct

### Migration breaks existing tours

The application is backward compatible. Old tours with S3 URLs will continue to work. New uploads will use Supabase.

## Rollback Plan

If you need to rollback to S3:

1. Restore old environment variables in `.env.local`
2. Run: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
3. Restore API routes from git history
4. Redeploy

## Benefits of Supabase Storage

✅ **Simpler Setup**: No AWS IAM, policies, or complex permissions
✅ **Built-in CDN**: Automatic global content delivery
✅ **Image Transformations**: Resize and optimize images on the fly
✅ **Resumable Uploads**: Large file support with TUS protocol
✅ **Real-time**: Subscribe to storage events (future feature)
✅ **Integrated Auth**: Seamless with Supabase Auth (if you add user accounts)
✅ **Better Pricing**: 1GB free, then ~$0.021/GB vs S3's complex pricing

## Next Steps

- ✅ Storage migration complete
- 🔄 Consider adding Supabase Auth for user management
- 🔄 Use Supabase Database for tours instead of localStorage
- 🔄 Add real-time collaboration features
- 🔄 Implement image transformations for tour thumbnails

## Support

For issues or questions:
- Supabase Docs: https://supabase.com/docs/guides/storage
- Supabase Discord: https://discord.supabase.com
- Project GitHub: [Your repository URL]
