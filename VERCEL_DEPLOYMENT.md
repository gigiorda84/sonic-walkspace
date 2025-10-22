# Vercel Deployment - Post-Migration Steps

## ✅ Deployment Status

**Production URL**: https://sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app

**Build Status**: ✅ Successful
**Git Push**: ✅ Complete
**Code Version**: Latest (with Supabase migration)

## 🚨 Action Required: Update Environment Variables

The deployment succeeded but you need to add Supabase environment variables to Vercel.

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/gigiordas-projects/sonic-walkscape-full-s3
2. Click **Settings** → **Environment Variables**

### Step 2: Remove Old AWS Variables (if present)

Delete these if they exist:
- `BUNDLES_S3_URL`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_PUBLIC_READ`

### Step 3: Add New Supabase Variables

Add these 4 environment variables:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://kiwufyymymzuapbjatat.supabase.co`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `sb_publishable_VJG7Il93z4QAdV7EHHpB2Q_4fIBkHfy`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 3: SUPABASE_SERVICE_ROLE_KEY
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `sb_secret_NqoH2TiN88z-jYMrharURw_KY59Ku5h`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- ⚠️ **Note**: This is sensitive! Keep it server-side only

#### Variable 4: STORAGE_URL
- **Name**: `STORAGE_URL`
- **Value**: `storage://walkscape-audio/tours`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 5: OPENAI_API_KEY (Keep existing)
- **Name**: `OPENAI_API_KEY`
- **Value**: `your-openai-api-key-here`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: Keep your existing OpenAI key from .env.local

### Step 4: Redeploy

After adding the variables:

**Option A: Via Vercel Dashboard**
1. Go to **Deployments** tab
2. Click the three dots (**...**) on the latest deployment
3. Click **Redeploy**

**Option B: Via CLI**
```bash
vercel --prod
```

### Step 5: Verify Production

After redeployment, test the API:

```bash
curl https://sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app/api/s3/status
```

Expected response:
```json
{
  "status": "success",
  "bucket": "walkscape-audio",
  "storageInfo": {
    "message": "Upload test successful - Supabase Storage is working correctly"
  }
}
```

## Testing Production

### Test 1: Health Check
Visit: https://sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app/api/s3/status

Should return: `{"status":"success",...}`

### Test 2: CMS Interface
Visit: https://sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app/cms

Should load without errors.

### Test 3: Upload Audio
1. Open CMS in production
2. Select "Presenti Mai Assenti" tour
3. Try uploading audio
4. Check Supabase dashboard to verify file appears

### Test 4: Player Interface
Visit: https://sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app/player

Should show published tours.

## Tour Data Migration

The tour "Presenti Mai Assenti" is stored in localStorage locally. To make it available in production:

### Option 1: Publish via CMS
1. Open local CMS: http://localhost:3000/cms
2. Go to **Publish** tab
3. Click "Publish to Supabase"
4. This uploads tour manifest to Supabase Storage

### Option 2: Manual Export/Import
1. Export tour data from local CMS
2. Import in production CMS
3. Re-upload audio files

## Deployment Commands Reference

### Deploy to Production
```bash
vercel --prod
```

### Check Deployment Status
```bash
vercel ls
```

### View Deployment Logs
```bash
vercel logs sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app
```

### Inspect Latest Deployment
```bash
vercel inspect sonic-walkscape-full-s3-ooduv4mzo-gigiordas-projects.vercel.app --logs
```

## Rollback Plan

If production has issues:

### Option 1: Rollback via Dashboard
1. Go to Vercel → Deployments
2. Find previous working deployment
3. Click **Promote to Production**

### Option 2: Rollback via CLI
```bash
vercel rollback
```

## Custom Domain Setup (Optional)

If you want a custom domain:

1. Go to Vercel → **Domains**
2. Add your domain (e.g., `walkscape.example.com`)
3. Follow DNS configuration instructions
4. Domain will auto-renew SSL certificates

## Summary

- ✅ Code deployed to production
- ✅ Build successful
- ⏳ **Pending**: Add Supabase environment variables
- ⏳ **Pending**: Redeploy after adding env vars
- ⏳ **Pending**: Test production endpoints
- ⏳ **Pending**: Publish tour to production

## Next Steps

1. **[NOW]** Add environment variables in Vercel dashboard
2. **[NOW]** Redeploy to apply environment variables
3. **[THEN]** Test production API endpoints
4. **[THEN]** Publish "Presenti Mai Assenti" tour
5. **[OPTIONAL]** Set up custom domain

---

**Deployment Date**: 2025-10-22
**Deployment ID**: FFJEtegN5n3cjj6yfUo5Lhk1ovgY
**Build Time**: ~25 seconds
**Status**: ✅ Built, ⏳ Env Vars Needed
