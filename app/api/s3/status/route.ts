import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

function parseS3(u?: string) {
  if (!u) return { bucket: '', prefix: '' };
  const m = u.match(/^s3:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!m) return { bucket: '', prefix: '' };
  return { bucket: m[1], prefix: (m[2] || '').replace(/^\/+|\/+$/g, '') };
}

export async function GET() {
  try {
    const baseS3 = process.env.BUNDLES_S3_URL;
    if (!baseS3) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'BUNDLES_S3_URL not configured',
        config: {
          awsRegion: process.env.AWS_REGION || 'NOT SET',
          awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
          awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
          s3PublicRead: process.env.S3_PUBLIC_READ || 'NOT SET'
        }
      }, { status: 400 });
    }

    const { bucket, prefix } = parseS3(baseS3);
    if (!bucket) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Invalid S3 URL format',
        s3Url: baseS3
      }, { status: 400 });
    }

    // Create S3 client
    const client = new S3Client({ 
      region: process.env.AWS_REGION || 'eu-west-1', 
      credentials: process.env.AWS_ACCESS_KEY_ID ? { 
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!, 
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! 
      } : undefined 
    });

    // Test connection by listing objects
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 10
    });

    const result = await client.send(command);
    
    return NextResponse.json({
      status: 'success',
      bucket,
      prefix,
      config: {
        awsRegion: process.env.AWS_REGION || 'eu-west-1',
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
        s3PublicRead: process.env.S3_PUBLIC_READ || 'NOT SET'
      },
      bucketInfo: {
        totalObjects: result.KeyCount || 0,
        sampleObjects: result.Contents?.slice(0, 5).map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified
        })) || []
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message || 'Unknown error',
      config: {
        awsRegion: process.env.AWS_REGION || 'NOT SET',
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
        s3PublicRead: process.env.S3_PUBLIC_READ || 'NOT SET'
      }
    }, { status: 500 });
  }
}
