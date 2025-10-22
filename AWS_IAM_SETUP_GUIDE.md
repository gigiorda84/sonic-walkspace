# AWS IAM Permissions Setup Guide

This guide will walk you through adding the required S3 permissions to your IAM user for Sonic Walkscape.

## Overview

Your IAM user `sonic-walkscape-app` needs permissions to:
- Read objects from S3 (`s3:GetObject`)
- Write objects to S3 (`s3:PutObject`)
- Delete objects from S3 (`s3:DeleteObject`)
- List bucket contents (`s3:ListBucket`)

## Step-by-Step Instructions

### Step 1: Log into AWS Console

1. Go to https://console.aws.amazon.com/
2. Sign in with your AWS account credentials
3. Make sure you're in the correct region (currently: **eu-north-1** - Stockholm)

### Step 2: Navigate to IAM

1. In the AWS Console search bar at the top, type **IAM**
2. Click on **IAM** (Identity and Access Management) from the results
3. Or go directly to: https://console.aws.amazon.com/iam/

### Step 3: Find Your IAM User

1. In the left sidebar, click **Users**
2. In the user list, find and click **sonic-walkscape-app**
   - This is the user with access key: `AKIAYQ7E4DCHP2TONTQY`

### Step 4: View Current Permissions

1. Click on the **Permissions** tab
2. You'll see a list of attached policies
3. Look for a policy that grants S3 access (might be called something like `sonic-walkscape-s3-policy` or a custom inline policy)

### Step 5: Edit the Policy

**Option A: If you have an existing inline policy:**

1. Under **Permissions policies**, find the inline policy
2. Click the **Edit** button (or click on the policy name, then **Edit policy**)
3. Click the **JSON** tab
4. Replace the entire JSON with the policy below

**Option B: If you have a managed policy attached:**

1. You may need to create a new inline policy instead
2. Click **Add permissions** → **Create inline policy**
3. Click the **JSON** tab
4. Paste the policy below

**Option C: Create a new inline policy:**

1. Click **Add permissions** (dropdown button)
2. Select **Create inline policy**
3. Click the **JSON** tab
4. Paste the policy below

### Step 6: Use This Policy JSON

Replace `your-bucket-name` with your actual bucket name: **gigiorda-walkspace**

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

**Important Notes:**
- The first statement uses `gigiorda-walkspace/*` (with `/*`) for object operations
- The second statement uses `gigiorda-walkspace` (without `/*`) for bucket operations
- This separation is required by AWS S3 permissions model

### Step 7: Review and Save

1. Click **Review policy** (or **Next** if using the wizard)
2. If creating a new inline policy, name it: `SonicWalkscapeS3FullAccess`
3. Add a description: `Full S3 access for Sonic Walkscape tour storage`
4. Click **Create policy** or **Save changes**

### Step 8: Verify Permissions

After saving, you should see:
- The policy listed under **Permissions policies**
- A green checkmark or success message
- The policy shows the correct actions and resources

## Alternative: Using AWS CLI

If you prefer the command line, you can add permissions using AWS CLI:

### 1. Create a policy file

Create a file named `sonic-walkscape-policy.json`:

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

### 2. Attach the policy to the user

```bash
# Put the inline policy on the user
aws iam put-user-policy \
  --user-name sonic-walkscape-app \
  --policy-name SonicWalkscapeS3FullAccess \
  --policy-document file://sonic-walkscape-policy.json

# Verify the policy was attached
aws iam get-user-policy \
  --user-name sonic-walkscape-app \
  --policy-name SonicWalkscapeS3FullAccess
```

## Testing the Permissions

After adding permissions, test them:

### Method 1: Using the Vercel App

1. Go to your CMS: https://sonic-walkscape-full-s3-ghmo3s479-gigiordas-projects.vercel.app/cms
2. Create or select a tour
3. Check the **Published** checkbox
4. If successful, you'll see: "✅ Tour published successfully!"
5. Go to Player: https://sonic-walkscape-full-s3-ghmo3s479-gigiordas-projects.vercel.app/player
6. Open browser console (F12)
7. Look for: "🌐 Loading tours from S3..." followed by "✅ Loaded X tours from S3"

### Method 2: Using AWS CLI

```bash
# Set your AWS credentials
export AWS_ACCESS_KEY_ID=AKIAYQ7E4DCHP2TONTQY
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=eu-north-1

# Test ListBucket permission
aws s3 ls s3://gigiorda-walkspace/walkspace/tours/

# Test GetObject permission (if a file exists)
aws s3 cp s3://gigiorda-walkspace/walkspace/tours/index.json ./test-index.json

# Test PutObject permission
echo '{"test": true}' > test-file.json
aws s3 cp test-file.json s3://gigiorda-walkspace/walkspace/tours/test/test-file.json

# Clean up test file
aws s3 rm s3://gigiorda-walkspace/walkspace/tours/test/test-file.json
rm test-file.json test-index.json
```

## Troubleshooting

### Error: "Access Denied" or "User is not authorized"

**Cause**: The IAM policy hasn't been applied correctly

**Solutions**:
1. Double-check the bucket name in the policy: `gigiorda-walkspace`
2. Verify both Resource ARNs are correct:
   - `arn:aws:s3:::gigiorda-walkspace/*` (with `/*`)
   - `arn:aws:s3:::gigiorda-walkspace` (without `/*`)
3. Make sure you saved the policy after editing
4. Wait 1-2 minutes for AWS to propagate the changes

### Error: "InvalidAccessKeyId"

**Cause**: The AWS credentials in Vercel are incorrect or outdated

**Solutions**:
1. Verify the credentials in `.env.local` match your IAM user
2. If you generated new access keys, update them in:
   - `.env.local` (local development)
   - Vercel dashboard → Settings → Environment Variables
3. Redeploy: `vercel --prod`

### Error: "Bucket does not exist"

**Cause**: The bucket name is wrong or doesn't exist

**Solutions**:
1. Verify bucket exists: Go to https://s3.console.aws.amazon.com/s3/buckets
2. Check bucket name in `BUNDLES_S3_URL`: `s3://gigiorda-walkspace/walkspace`
3. Verify you're in the correct AWS region (eu-north-1)

### Error: "No tours loading in Player"

**Cause**: Either permissions issue or no tours published yet

**Solutions**:
1. Check browser console for error messages
2. Publish a tour from CMS first
3. Verify `tours/index.json` exists in S3 bucket
4. Check Vercel logs: `vercel logs --follow`

## Security Best Practices

### 1. Use Least Privilege

The policy provided grants only the permissions needed:
- ✅ Read/Write/Delete objects in the bucket
- ✅ List bucket contents
- ❌ No ability to delete the bucket itself
- ❌ No access to other AWS services

### 2. Use Environment Variables

Never commit AWS credentials to git:
- ✅ Store in `.env.local` (gitignored)
- ✅ Store in Vercel environment variables
- ❌ Never in source code
- ❌ Never in public repositories

### 3. Rotate Access Keys Regularly

1. Generate new access keys every 90 days
2. Update them in `.env.local` and Vercel
3. Delete old access keys after verification

### 4. Monitor Usage

1. Enable AWS CloudTrail for audit logs
2. Set up CloudWatch alerts for unusual activity
3. Review IAM Access Advisor to see which permissions are actually used

## What This Policy Allows

| Action | Description | Used For |
|--------|-------------|----------|
| `s3:GetObject` | Download files from S3 | Player loads tour manifests and audio |
| `s3:PutObject` | Upload files to S3 | CMS publishes tours, uploads audio |
| `s3:DeleteObject` | Delete files from S3 | CMS deletes old tours or audio files |
| `s3:ListBucket` | List files in bucket | API lists all published tours |

## Restricted Access (Not Granted)

| Action | Why Not Needed |
|--------|----------------|
| `s3:CreateBucket` | Bucket already exists |
| `s3:DeleteBucket` | Never want to delete the bucket |
| `s3:PutBucketPolicy` | Bucket policy managed separately |
| `s3:PutBucketAcl` | ACLs not needed |

## Next Steps After Setup

Once permissions are configured:

1. ✅ Test publishing a tour from CMS
2. ✅ Verify tour appears in Player
3. ✅ Check S3 bucket for `tours/index.json`
4. ✅ Test on mobile device (different network)
5. ✅ Monitor Vercel logs for errors

## Support

If you encounter issues:

1. **Check Vercel Logs**:
   ```bash
   vercel logs --follow
   ```

2. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed API calls

3. **Test S3 Connectivity**:
   ```bash
   npm run test:s3
   ```

4. **Review Documentation**:
   - `DEPLOYMENT_GUIDE.md` - Full deployment guide
   - `STORAGE_ARCHITECTURE.md` - Technical architecture
   - `S3_CONFIGURATION.md` - S3 setup details

## Quick Reference

**Bucket Name**: `gigiorda-walkspace`
**Region**: `eu-north-1` (Stockholm)
**IAM User**: `sonic-walkscape-app`
**Prefix**: `walkspace/tours/`

**AWS Console Links**:
- IAM Users: https://console.aws.amazon.com/iam/home#/users
- S3 Bucket: https://s3.console.aws.amazon.com/s3/buckets/gigiorda-walkspace
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/

**Vercel Links**:
- Dashboard: https://vercel.com/gigiordas-projects/sonic-walkscape-full-s3
- Deployments: https://vercel.com/gigiordas-projects/sonic-walkscape-full-s3/deployments
- Settings: https://vercel.com/gigiordas-projects/sonic-walkscape-full-s3/settings
