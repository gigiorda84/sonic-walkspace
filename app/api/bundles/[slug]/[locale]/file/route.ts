import { NextResponse } from 'next/server';
import { parseStorageUrl, getSupabasePublicUrl } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: { slug: string, locale: string }}) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '';

  const storageUrl = process.env.STORAGE_URL;
  if (storageUrl) {
    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    if (bucket) {
      const filePath = `${prefix ? prefix + '/' : ''}${params.slug}/${params.locale}/${path}`;
      const url = getSupabasePublicUrl(bucket, filePath);
      return NextResponse.json({ url });
    }
  }

  return NextResponse.json({ url: null });
}