# S3 Configuration Guide for Sonic Walkscape

## 🚀 Quick Setup

### 1. AWS S3 Bucket Setup

1. **Create S3 Bucket**:
   - Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
   - Create bucket: `gigiorda-walkspace`
   - Region: `eu-west-1` (Ireland)
   - Block Public Access: Keep default (blocked)
   - Enable default encryption (SSE-S3)

2. **Configure Bucket Policy** (for public read access):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::gigiorda-walkspace/*"
        }
    ]
}
```

### 2. IAM Group and User Setup

1. **Create IAM Group**:
   - Go to [IAM Console](https://console.aws.amazon.com/iam/)
   - Click "Groups" → "Create group"
   - Group name: `SonicWalkscapeS3Users`
   - Description: `Users with S3 access for Sonic Walkscape project`

2. **Create Custom Policy for Group**:
   - Go to "Policies" → "Create policy"
   - Use JSON editor and paste:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::gigiorda-walkspace/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::gigiorda-walkspace"
        }
    ]
}
```

3. **Attach Policy to Group**:
   - Select the `SonicWalkscapeS3Users` group
   - Click "Attach policies"
   - Search for and select your custom policy

4. **Create IAM User**:
   - Go to "Users" → "Create user"
   - User name: `sonic-walkscape-app`
   - Access type: Programmatic access
   - **Don't attach policies directly**

5. **Add User to Group**:
   - Select the `sonic-walkscape-app` user
   - Click "Add to group"
   - Select `SonicWalkscapeS3Users`
   - User automatically gets group permissions

### 3. Environment Configuration

Update your `.env.local` file:

```bash
# S3 Configuration for Sonic Walkscape
# =====================================

# S3 Bucket URL for reading bundles and assets
# Format: s3://bucket-name/prefix
BUNDLES_S3_URL=s3://gigiorda-walkspace/walkspace

# AWS Configuration for uploads
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_HERE
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY_HERE

# Enable public read access for uploaded files
# Set to 1 to make uploaded files publicly accessible via HTTP
S3_PUBLIC_READ=1

# Optional: CloudFront Distribution (for CDN)
# CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

## 📁 File Structure

Your S3 bucket will store files in this structure:
```
gigiorda-walkspace/
└── walkspace/
    └── {tour-slug}/
        └── {locale}/
            ├── audio/
            │   ├── region-1.mp3
            │   ├── region-2.mp3
            │   └── ...
            └── images/
                ├── region-1.jpg
                ├── region-2.jpg
                └── ...
```

## 🔧 Advanced Configuration

### CloudFront CDN (Optional)

1. **Create CloudFront Distribution**:
   - Origin: Your S3 bucket
   - Behaviors: Cache audio and image files
   - Price Class: Use Only North America and Europe

2. **Update Environment**:
```bash
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

### CORS Configuration

Add CORS policy to your S3 bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
        "ExposeHeaders": []
    }
]
```

## 🧪 Testing

1. **Test Upload**:
   - Go to CMS
   - Try uploading an audio file
   - Check S3 bucket for the file

2. **Test Download**:
   - Go to Player
   - Select a tour with audio
   - Verify audio plays correctly

## 🔒 Security Best Practices

1. **Use IAM Roles** (for production):
   - Instead of access keys, use IAM roles
   - More secure for server deployments

2. **Enable Bucket Versioning**:
   - Protects against accidental deletions
   - Useful for backup and recovery

3. **Set up Lifecycle Policies**:
   - Automatically delete old files
   - Move files to cheaper storage classes

4. **Monitor Access**:
   - Enable CloudTrail for S3
   - Set up CloudWatch alarms

## 🚨 Troubleshooting

### Common Issues:

1. **"Access Denied"**:
   - Check IAM permissions
   - Verify bucket policy
   - Ensure CORS is configured

2. **"Invalid Access Key"**:
   - Verify AWS credentials
   - Check region configuration

3. **"File Not Found"**:
   - Check file path in S3
   - Verify bucket name and prefix

### Debug Commands:

```bash
# Test S3 connection
aws s3 ls s3://gigiorda-walkspace/

# List files in bucket
aws s3 ls s3://gigiorda-walkspace/walkspace/ --recursive

# Upload test file
aws s3 cp test.mp3 s3://gigiorda-walkspace/walkspace/test/
```
