# Quick IAM Setup (5 Minutes)

## TL;DR - Copy This Policy

1. **Go to**: https://console.aws.amazon.com/iam/home#/users/sonic-walkscape-app
2. **Click**: "Permissions" tab → "Add permissions" → "Create inline policy"
3. **Click**: "JSON" tab
4. **Paste this**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SonicWalkscapeTourStorage",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::gigiorda-walkspace/*"
    },
    {
      "Sid": "SonicWalkscapeListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::gigiorda-walkspace"
    }
  ]
}
```

5. **Click**: "Review policy"
6. **Name it**: `SonicWalkscapeS3FullAccess`
7. **Click**: "Create policy"

## Visual Steps

```
AWS Console
    ↓
IAM Dashboard
    ↓
Users → sonic-walkscape-app
    ↓
Permissions Tab
    ↓
Add permissions → Create inline policy
    ↓
JSON Tab → Paste policy above
    ↓
Review → Name: SonicWalkscapeS3FullAccess
    ↓
Create policy
    ↓
✅ DONE!
```

## Test It Works

### In Browser:

1. Go to: https://sonic-walkscape-full-s3-ghmo3s479-gigiordas-projects.vercel.app/cms
2. Create a tour with at least one region
3. Check "Published" ✅
4. Should see: "✅ Tour published successfully!"

### In Console:

```bash
# Open browser console (F12) on Player page
# Should see these logs:
🌐 Loading tours from S3...
✅ Loaded X tours from S3
```

## Why Two Statements?

**Statement 1** (`gigiorda-walkspace/*`):
- For FILE operations (read, write, delete)
- The `/*` means "all objects in bucket"

**Statement 2** (`gigiorda-walkspace`):
- For BUCKET operations (list contents)
- No `/*` because you're listing the bucket itself

This is how AWS S3 permissions work - object operations and bucket operations need separate statements.

## Common Errors After Setup

### Error: "Access Denied"
- **Wait 1-2 minutes** - AWS takes time to propagate changes
- Refresh your Vercel app
- Try publishing again

### Error: "InvalidAccessKeyId"
- Check Vercel environment variables
- Make sure `AWS_ACCESS_KEY_ID` matches your IAM user
- Redeploy: `vercel --prod`

### No tours loading
- Check browser console for errors
- Verify a tour was published first
- Check S3 bucket has `walkspace/tours/index.json`

## Need More Help?

See **AWS_IAM_SETUP_GUIDE.md** for:
- Detailed screenshots/descriptions
- AWS CLI method
- Troubleshooting guide
- Security best practices
- Alternative approaches

## What Happens After Setup

```
CMS (Publish Tour)
    ↓
POST /api/tours/publish
    ↓
Saves to S3: gigiorda-walkspace/walkspace/tours/{slug}/manifest.json
    ↓
Updates: gigiorda-walkspace/walkspace/tours/index.json
    ↓
Player Loads
    ↓
GET /api/tours/list
    ↓
Shows all published tours to all users
```

## Key Files in S3 After First Publish

```
gigiorda-walkspace/
└── walkspace/
    └── tours/
        ├── index.json                          ← List of all tours
        └── bandite-demo/                       ← Your tour slug
            ├── manifest.json                   ← Complete tour data
            └── audio/
                └── it-IT/
                    └── region-123.mp3          ← Audio files
```

That's it! Once the policy is added, your app will work across all users and devices.
