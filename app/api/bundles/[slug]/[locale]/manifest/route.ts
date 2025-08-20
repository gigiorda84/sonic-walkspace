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

export async function GET(_req: Request, { params }: { params: { slug: string, locale: string }}) {
  const baseS3 = process.env.BUNDLES_S3_URL; // es. s3://gigiorda/walkspace
  if (baseS3) {
    const httpsBase = s3ToHttps(baseS3);
    const url = `${httpsBase}/${params.slug}/${params.locale}/manifest.json`;
    return NextResponse.json({ version: Date.now(), url });
  }
  const manifest = { version: Date.now(), files: [{ path: 'regions.geojson', bytes: 2048, sha256: 'mock' }], playback: { dwellSecDefault: 4, crossfadeMs: 600 } };
  const inline = 'data:application/json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64');
  return NextResponse.json({ version: manifest.version, url: inline });
}