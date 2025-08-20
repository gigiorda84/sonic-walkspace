import { NextResponse } from 'next/server';

function s3ToHttps(u?: string) {
  if (!u) return '';
  const m = u.match(/^s3:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!m) return '';
  const bucket = m[1];
  const prefix = (m[2] || '').replace(/^\/+|\/+$/g, '');
  const base = `https://${bucket}.s3.amazonaws.com`;
  return prefix ? `${base}/${prefix}` : base;
}

export async function GET(req: Request, { params }: { params: { slug: string, locale: string }}) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '';
  const baseS3 = process.env.BUNDLES_S3_URL; // es. s3://gigiorda/walkspace
  if (baseS3) {
    const httpsBase = s3ToHttps(baseS3);
    const url = `${httpsBase}/${params.slug}/${params.locale}/${path}`;
    return NextResponse.json({ url });
  }
  return NextResponse.json({ url: null });
}