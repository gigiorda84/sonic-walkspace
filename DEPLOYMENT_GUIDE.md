# Deployment Guide: S3-Based Shared Tour Storage

## Overview

The Sonic Walkscape app has been updated to store tours, audio tracks, and subtitles on S3, making them available to all users across devices. This guide explains the architecture and deployment process.

## Architecture Changes

### Previous Architecture
- Tours stored only in browser `localStorage`
- Each user could only see their own tours
- No way to share tours between users/devices

### New Architecture
- Tours stored in AWS S3 (shared storage)
- CMS publishes tours to S3 when "Published" checkbox is enabled
- Player loads tours from S3 + localStorage (backward compatible)
- Audio files remain on S3 (no change)

### S3 File Structure

```
s3://bucket/prefix/
└── tours/
    ├── index.json                      # List of all published tours
    └── {tour-slug}/
        ├── manifest.json               # Complete tour data
        ├── audio/
        │   └── {locale}/
        │       └── {regionId}.mp3
        └── subtitles/
            └── {locale}/
                └── {regionId}.srt
```

## New API Endpoints

### 1. `GET /api/tours/list`
Returns list of all published tours from S3 index.

**Response:**
```json
{
  "tours": [
    {
      "slug": "bandite-demo",
      "title": "BANDITE — Demo Tour",
      "description": "Passeggiata sonora...",
      "priceEUR": 3.99,
      "locales": [...],
      "published": true,
      "updatedAt": "2025-01-20T15:00:00Z",
      "manifestUrl": "walkspace/tours/bandite-demo/manifest.json"
    }
  ]
}
```

### 2. `POST /api/tours/publish`
Saves tour manifest to S3 and updates the index.

**Request Body:**
```json
{
  "slug": "my-tour",
  "title": "My Tour",
  "description": "...",
  "regions": [...],
  "tracks": {...},
  "subtitles": {...}
}
```

**Response:**
```json
{
  "success": true,
  "tour": {...},
  "manifestUrl": "https://bucket.s3.region.amazonaws.com/..."
}
```

### 3. `GET /api/tours/{slug}`
Fetches complete tour manifest from S3.

**Response:**
```json
{
  "tour": {
    "id": "...",
    "slug": "bandite-demo",
    "title": "BANDITE — Demo Tour",
    "regions": [...],
    "tracks": {...},
    "subtitles": {...}
  }
}
```

## IAM Permissions Required

Your AWS IAM user needs these additional permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
      ]
    }
  ]
}
```

**Note:** The error during build shows `s3:ListBucket` permission is missing. This needs to be added to the IAM policy.

## How It Works

### CMS Workflow

1. **Create Tour**: User creates tour in CMS (stored in localStorage as draft)
2. **Add Content**: User adds regions, uploads audio, generates subtitles
3. **Publish**: User checks "Published" checkbox
4. **Auto-Sync**: Tour automatically syncs to S3 via `/api/tours/publish`
5. **Confirmation**: Alert shows success/failure message

### Player Workflow

1. **On Load**: Player fetches tour list from `/api/tours/list`
2. **Load Manifests**: For each tour, fetches full manifest from `/api/tours/{slug}`
3. **Merge**: Combines S3 tours with local tours (backward compatible)
4. **Display**: Shows all tours in selection modal
5. **GPS Trigger**: Plays audio from S3 URLs when user enters regions

## Deployment Steps

### 1. Update IAM Permissions

Add `s3:ListBucket` permission to your IAM user policy (see above).

### 2. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or push to GitHub (if Git integration enabled)
git add .
git commit -m "Add S3-based shared tour storage"
git push origin main
```

### 3. Configure Environment Variables

Ensure these variables are set in Vercel dashboard:

- `BUNDLES_S3_URL` - S3 bucket URL (s3://bucket-name/prefix)
- `AWS_REGION` - AWS region (eu-north-1)
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `S3_PUBLIC_READ` - Set to `1` for public read access
- `OPENAI_API_KEY` - OpenAI API key (for subtitles)

### 4. Test End-to-End

1. **CMS Test**:
   - Open `/cms`
   - Create a new tour with at least one region
   - Upload audio for the region
   - Check "Published" checkbox
   - Confirm success alert appears

2. **Player Test**:
   - Open `/player` in a different browser/device
   - Wait for tours to load (check console: "🌐 Loading tours from S3...")
   - Confirm tour appears in list
   - Select tour and test GPS triggering

3. **S3 Verification**:
   - Check S3 bucket for `tours/index.json`
   - Check for `tours/{slug}/manifest.json`
   - Verify audio files exist in expected locations

## Backward Compatibility

The system maintains backward compatibility:

- **CMS**: Still saves to localStorage (drafts)
- **Player**: Loads both localStorage AND S3 tours
- **Duplicates**: Automatically filtered by slug
- **No Breaking Changes**: Existing tours continue to work

## Troubleshooting

### Tours not appearing in Player

1. Check browser console for errors
2. Verify S3 permissions (s3:ListBucket, s3:GetObject)
3. Check network tab for failed API calls
4. Verify tour has `published: true` flag
5. Confirm tour has valid slug and regions

### Publish fails with error

1. Check IAM permissions
2. Verify environment variables in Vercel
3. Check S3 bucket exists and is accessible
4. Review API logs in Vercel dashboard

### Build warnings about S3

- During `next build`, API routes are pre-rendered
- S3 errors during build are non-fatal (APIs handle at runtime)
- Ensure environment variables are set in Vercel

## Monitoring

### Console Logs

**CMS:**
- `📤 Publishing tour to S3: {title}`
- `✅ Tour published to S3: {url}`

**Player:**
- `🌐 Loading tours from S3...`
- `✅ Loaded {count} tours from S3`

### Vercel Logs

Check deployment logs for API errors:
```bash
vercel logs --follow
```

## Security Notes

1. **Public Read**: Tours are publicly readable if `S3_PUBLIC_READ=1`
2. **No Auth**: Currently no authentication on CMS
3. **API Keys**: Keep AWS credentials in environment variables (never commit)
4. **CORS**: Ensure S3 bucket allows CORS from your domain

## Future Enhancements

Potential improvements:
- Add authentication/authorization
- Implement tour versioning
- Add tour unpublish functionality
- Cache manifests in Player localStorage
- Add tour analytics and usage tracking
- Implement collaborative editing

## Support

For issues or questions:
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Documentation: See STORAGE_ARCHITECTURE.md for technical details
