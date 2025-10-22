import { NextResponse } from 'next/server';
import { getSupabaseAdmin, parseStorageUrl } from '@/lib/supabase';

export async function GET() {
  try {
    // Check environment variables
    const storageUrl = process.env.STORAGE_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!storageUrl) {
      return NextResponse.json({
        status: 'error',
        message: 'STORAGE_URL not configured',
        config: {
          supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
          serviceRoleKey: serviceRoleKey ? 'SET' : 'NOT SET',
          storageUrl: 'NOT SET'
        }
      }, { status: 400 });
    }

    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    if (!bucket) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid STORAGE_URL format',
        storageUrl
      }, { status: 400 });
    }

    // Test connection by listing buckets or uploading a test file
    const supabase = getSupabaseAdmin();
    const testPath = `${prefix ? prefix + '/' : ''}test/status-check.txt`;
    const testContent = `Supabase Status Check - ${new Date().toISOString()}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: `Storage test failed: ${error.message}`,
        config: {
          supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
          serviceRoleKey: serviceRoleKey ? 'SET' : 'NOT SET',
          storageUrl: storageUrl
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      bucket,
      prefix,
      config: {
        supabaseUrl: supabaseUrl || 'NOT SET',
        serviceRoleKey: serviceRoleKey ? 'SET' : 'NOT SET',
        storageUrl: storageUrl
      },
      storageInfo: {
        message: 'Upload test successful - Supabase Storage is working correctly',
        testFile: testPath,
        uploadedPath: data.path
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Unknown error',
      config: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        storageUrl: process.env.STORAGE_URL || 'NOT SET'
      }
    }, { status: 500 });
  }
}
