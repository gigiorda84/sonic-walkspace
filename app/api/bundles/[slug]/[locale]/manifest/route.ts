import { NextResponse } from 'next/server';
import { parseStorageUrl, getSupabasePublicUrl } from '@/lib/supabase';

export async function GET(_req: Request, { params }: { params: { slug: string, locale: string }}) {
  const storageUrl = process.env.STORAGE_URL;

  if (storageUrl) {
    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    if (bucket) {
      // Build manifest path
      const manifestPath = `${prefix ? prefix + '/' : ''}${params.slug}/${params.locale}/manifest.json`;
      const url = getSupabasePublicUrl(bucket, manifestPath);
      return NextResponse.json({ version: Date.now(), url });
    }
  }

  // Fallback: return inline manifest for testing
  const manifest = {
    version: Date.now(),
    files: [{ path: 'regions.geojson', bytes: 2048, sha256: 'mock' }],
    playback: { dwellSecDefault: 4, crossfadeMs: 600 }
  };
  const inline = 'data:application/json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64');
  return NextResponse.json({ version: manifest.version, url: inline });
}