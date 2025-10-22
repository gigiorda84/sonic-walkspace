import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, parseStorageUrl } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { keys, tourTitle } = await request.json();

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'No file keys provided' },
        { status: 400 }
      );
    }

    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: 'STORAGE_URL not configured' }, { status: 400 });
    }

    const { bucket } = parseStorageUrl(storageUrl);
    if (!bucket) {
      return NextResponse.json({ error: 'Invalid STORAGE_URL' }, { status: 400 });
    }

    console.log(`🗑️ Deleting ${keys.length} Supabase Storage files for tour: ${tourTitle || 'Unknown'}`);

    const supabase = getSupabaseAdmin();
    const deleteResults = [];
    const errors = [];

    // Delete files one by one
    for (const key of keys) {
      try {
        console.log(`🗑️ Deleting file: ${key}`);

        const { error } = await supabase.storage
          .from(bucket)
          .remove([key]);

        if (error) {
          console.error(`❌ Failed to delete ${key}:`, error);
          errors.push({ key, error: error.message });
        } else {
          deleteResults.push({ key, status: 'deleted' });
          console.log(`✅ Deleted: ${key}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to delete ${key}:`, error);
        errors.push({ key, error: error.message });
      }
    }

    const response = {
      bucket,
      tourTitle,
      deleted: deleteResults,
      errors,
      summary: {
        total: keys.length,
        successful: deleteResults.length,
        failed: errors.length
      }
    };

    if (errors.length === 0) {
      console.log(`✅ All ${keys.length} files deleted successfully for tour: ${tourTitle}`);
      return NextResponse.json({
        message: 'All files deleted successfully',
        ...response
      });
    } else {
      console.log(`⚠️ Partial success: ${deleteResults.length}/${keys.length} files deleted for tour: ${tourTitle}`);
      return NextResponse.json({
        message: 'Some files failed to delete',
        ...response
      }, { status: 207 }); // 207 Multi-Status
    }

  } catch (error: any) {
    console.error('❌ Storage delete operation failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete storage files',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Bulk delete support using Supabase's batch removal
export async function DELETE(request: NextRequest) {
  try {
    const { keys, tourTitle } = await request.json();

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'No file keys provided' },
        { status: 400 }
      );
    }

    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: 'STORAGE_URL not configured' }, { status: 400 });
    }

    const { bucket } = parseStorageUrl(storageUrl);
    if (!bucket) {
      return NextResponse.json({ error: 'Invalid STORAGE_URL' }, { status: 400 });
    }

    console.log(`🗑️ Bulk deleting ${keys.length} Supabase Storage files for tour: ${tourTitle || 'Unknown'}`);

    const supabase = getSupabaseAdmin();

    // Supabase supports bulk delete
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(keys);

    if (error) {
      console.error('❌ Bulk delete failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to bulk delete storage files',
          details: error.message
        },
        { status: 500 }
      );
    }

    const response = {
      bucket,
      tourTitle,
      deleted: data || [],
      errors: [],
      summary: {
        total: keys.length,
        successful: (data || []).length,
        failed: 0
      }
    };

    console.log(`✅ Bulk delete completed: ${response.summary.successful}/${response.summary.total} files deleted`);

    return NextResponse.json({
      message: 'Bulk delete completed',
      ...response
    });

  } catch (error: any) {
    console.error('❌ Storage bulk delete operation failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk delete storage files',
        details: error.message
      },
      { status: 500 }
    );
  }
}
