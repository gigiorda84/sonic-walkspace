import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function parseS3(u?: string) {
  if (!u) return { bucket:'', prefix:'' };
  const m = u.match(/^s3:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!m) return { bucket:'', prefix:'' };
  return { bucket: m[1], prefix: (m[2] || '').replace(/^\/+|\/+$/g, '') };
}

export async function POST(req: Request) {
  try {
    const { slug, locale, regionId, fileName, contentType } = await req.json();
    const baseS3 = process.env.BUNDLES_S3_URL;
    if (!baseS3) return NextResponse.json({ error: 'BUNDLES_S3_URL not set' }, { status: 400 });
    const { bucket, prefix } = parseS3(baseS3);
    if (!bucket) return NextResponse.json({ error: 'Invalid S3 URL' }, { status: 400 });

    const extGuess = (fileName && fileName.includes('.')) ? fileName.split('.').pop() : null;
    const ext = (extGuess || (contentType === 'audio/wav' ? 'wav' : 'mp3')).toLowerCase();
    const key = `${prefix ? prefix + '/' : ''}${slug}/${locale}/audio/${regionId}.${ext}`;

    const client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1', credentials: process.env.AWS_ACCESS_KEY_ID ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! } : undefined });
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || 'audio/mpeg', ACL: process.env.S3_PUBLIC_READ ? 'public-read' : undefined });
    const url = await getSignedUrl(client, command, { expiresIn: 900 });

    const httpUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
    return NextResponse.json({ url, method: 'PUT', key, httpUrl, headers: process.env.S3_PUBLIC_READ ? { 'x-amz-acl': 'public-read' } : {} });
  } catch (e:any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}