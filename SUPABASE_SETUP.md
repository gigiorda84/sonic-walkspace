# Supabase Setup Guide

Quick guide to set up Supabase Storage for Sonic Walkscape.

## Prerequisites

- A Supabase account (free at [supabase.com](https://supabase.com))
- Node.js 18+ installed
- This project cloned locally

## Step 1: Create Supabase Project

1. Visit [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `sonic-walkscape` (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `Europe West (London)`)
   - **Pricing Plan**: Free tier is perfect to start
4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning

## Step 2: Create Storage Bucket

1. In the left sidebar, click **"Storage"**
2. Click **"Create a new bucket"**
3. Configure the bucket:
   - **Name**: `walkscape-audio`
   - **Public bucket**: ✅ **Yes** (enable public access)
   - **File size limit**: 50 MB (for audio files)
   - **Allowed MIME types**: Leave empty (or add `audio/mpeg, audio/wav, audio/mp3`)
4. Click **"Create bucket"**

## Step 3: Configure Bucket Settings (Optional)

### Enable CORS

If you need to access files from different domains:

1. Go to **Storage** → **Policies**
2. Click your bucket → **Configuration**
3. Add CORS rules:

```json
[
  {
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "HEAD"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

### Set Storage Policies

For production, you might want granular policies:

1. Go to **Storage** → **Policies**
2. Add policies for your bucket:

**Public Read Policy** (already exists if bucket is public):
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'walkscape-audio' );
```

**Authenticated Upload Policy** (if you add authentication later):
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'walkscape-audio' );
```

## Step 4: Get Your API Keys

1. Go to **Settings** (gear icon) → **API**
2. Copy the following values:

   - **Project URL**:
     ```
     https://xxxxxxxxxxxxx.supabase.co
     ```

   - **Project API keys** → **anon public**:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
     ```

   - **Project API keys** → **service_role** (click "Reveal"):
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
     ```

⚠️ **Important**:
- The `anon` key is safe to use in client-side code
- The `service_role` key must NEVER be exposed (server-side only)

## Step 5: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Storage Configuration
# Format: storage://bucket-name/optional-prefix
STORAGE_URL=storage://walkscape-audio/tours

# OpenAI (for subtitle generation)
OPENAI_API_KEY=sk-proj-...
```

Replace the placeholder values with your actual keys from Step 4.

## Step 6: Install Dependencies

```bash
npm install
```

This installs `@supabase/supabase-js` and other required packages.

## Step 7: Test the Setup

Start the development server:

```bash
npm run dev
```

### Test Storage Connection

Open your browser or use curl:

```bash
curl http://localhost:3000/api/s3/status
```

Expected response (success):
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

### Test CMS Upload

1. Navigate to `http://localhost:3000/cms`
2. Click **"New Tour"** or select an existing tour
3. Go to the **"Regions"** tab
4. Add a region (latitude, longitude, radius)
5. Go to the **"Tracks"** tab
6. Upload an audio file (MP3, max 50MB)
7. Check the console for success message
8. Verify in Supabase dashboard:
   - Go to **Storage** → **walkscape-audio**
   - Navigate to `tours/{tour-slug}/{locale}/audio/`
   - You should see your uploaded file

## Step 8: Deploy to Production

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel:
   - Go to **Settings** → **Environment Variables**
   - Add the same variables from `.env.local`
   - Make sure to set them for **Production**, **Preview**, and **Development**

4. Deploy!

### Other Platforms

Add the same environment variables to your hosting platform's configuration:
- Netlify: **Site settings** → **Environment variables**
- Railway: **Variables** tab
- Render: **Environment** tab

## File Structure

Your files will be organized in Supabase Storage like this:

```
walkscape-audio/                     (bucket)
└── tours/                            (prefix from STORAGE_URL)
    └── bandite-demo/                 (tour slug)
        ├── it-IT/                    (locale)
        │   └── audio/
        │       ├── region-1.mp3
        │       ├── region-2.mp3
        │       └── region-3.mp3
        └── fr-FR/                    (locale)
            └── audio/
                └── region-1.mp3
```

## Accessing Files

Files are publicly accessible via:

```
https://xxxxx.supabase.co/storage/v1/object/public/walkscape-audio/tours/{slug}/{locale}/audio/{regionId}.mp3
```

Example:
```
https://abcdefgh.supabase.co/storage/v1/object/public/walkscape-audio/tours/bandite-demo/it-IT/audio/region-1.mp3
```

## Troubleshooting

### "STORAGE_URL not configured" Error

**Solution**: Check that `.env.local` contains:
```bash
STORAGE_URL=storage://walkscape-audio/tours
```

Restart the dev server: `npm run dev`

---

### "Storage test failed" Error

**Possible causes:**

1. **Wrong service role key**
   - Verify you copied the `service_role` key (not `anon` key)
   - Check for extra spaces or newlines

2. **Bucket doesn't exist**
   - Go to Supabase dashboard → Storage
   - Verify `walkscape-audio` bucket exists

3. **Permissions issue**
   - Ensure bucket is marked as **Public**
   - Check storage policies allow uploads

---

### Files Upload but Can't Be Accessed

**Solution**:

1. Verify bucket is **Public**:
   - Storage → walkscape-audio → Settings
   - "Public bucket" should be enabled

2. Check the public URL format:
   ```
   https://{project-ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
   ```

---

### Upload Fails in Production

**Solution**:

1. Check Vercel environment variables are set correctly
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not just `anon` key)
3. Check Vercel logs for detailed error messages
4. Ensure you've deployed after adding environment variables

---

### CORS Errors

**Solution**:

1. Go to Supabase → Storage → Configuration
2. Add CORS policy:
   ```json
   {
     "allowedOrigins": ["*"],
     "allowedMethods": ["GET", "HEAD"],
     "allowedHeaders": ["*"]
   }
   ```

## Storage Limits

**Free Tier:**
- 1 GB storage
- 2 GB bandwidth/month
- 50 MB max file size

**Pro Tier ($25/month):**
- 100 GB storage
- 200 GB bandwidth/month
- 5 GB max file size

For most walking tours, the free tier is sufficient!

## Security Best Practices

1. ✅ **Never commit `.env.local`** to git (already in `.gitignore`)
2. ✅ **Use `service_role` key only on server** (in API routes)
3. ✅ **Use `anon` key for client-side** (if needed in future)
4. ✅ **Enable Row Level Security (RLS)** if using database
5. ✅ **Set file size limits** in bucket settings
6. ✅ **Monitor usage** in Supabase dashboard

## Next Steps

- ✅ Storage setup complete!
- 🔄 Add more tours and regions in the CMS
- 🔄 Test the player on mobile devices
- 🔄 Consider adding Supabase Auth for user accounts
- 🔄 Migrate tours from localStorage to Supabase Database

## Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Supabase Storage API Reference](https://supabase.com/docs/reference/javascript/storage)
- [Migration Guide](./SUPABASE_MIGRATION_GUIDE.md) (if migrating from S3)

## Support

If you encounter issues:

1. Check Supabase dashboard → **Logs** for errors
2. Check browser console for client-side errors
3. Check API route logs in Vercel/terminal
4. Visit [Supabase Discord](https://discord.supabase.com) for community support
