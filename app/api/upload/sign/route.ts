import { NextResponse } from 'next/server';
import { getSupabaseAdmin, parseStorageUrl, getSupabasePublicUrl } from '@/lib/supabase';

// Configure route to accept large file uploads (50MB)
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { slug, locale, regionId, fileName, contentType, fileData } = await req.json();

    // Get storage configuration
    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: 'STORAGE_URL not set' }, { status: 400 });
    }

    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    if (!bucket) {
      return NextResponse.json({ error: 'Invalid STORAGE_URL format' }, { status: 400 });
    }

    // Determine file extension
    const extGuess = (fileName && fileName.includes('.')) ? fileName.split('.').pop() : null;
    const ext = (extGuess || (contentType === 'audio/wav' ? 'wav' : 'mp3')).toLowerCase();

    // Build storage path: prefix/slug/locale/audio/regionId.ext
    const filePath = `${prefix ? prefix + '/' : ''}${slug}/${locale}/audio/${regionId}.${ext}`;

    // If fileData is provided, upload directly (new behavior)
    if (fileData) {
      const supabase = getSupabaseAdmin();

      // Convert base64 to buffer
      const base64Data = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
      const buffer = Buffer.from(base64Data, 'base64');

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: contentType || 'audio/mpeg',
          upsert: true, // Allow overwriting existing files
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get public URL
      const publicUrl = getSupabasePublicUrl(bucket, filePath);

      return NextResponse.json({
        success: true,
        path: data.path,
        url: publicUrl,
        key: filePath
      });
    }

    // Return metadata for client-side upload (backward compatibility)
    // Note: Supabase Storage doesn't support presigned URLs the same way as S3
    // Client should upload via direct Supabase client instead
    const publicUrl = getSupabasePublicUrl(bucket, filePath);

    return NextResponse.json({
      bucket,
      path: filePath,
      url: publicUrl,
      key: filePath,
      // Signal to client to use direct Supabase upload
      useDirectUpload: true
    });

  } catch (e: any) {
    console.error('Upload sign error:', e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}