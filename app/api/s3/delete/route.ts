import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const BUCKET_NAME = process.env.BUNDLES_S3_URL?.split('://')[1]?.split('/')[0] || 'gigiorda-walkspace';

export async function POST(request: NextRequest) {
  try {
    const { keys, tourTitle } = await request.json();

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'No file keys provided' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Deleting ${keys.length} S3 files for tour: ${tourTitle || 'Unknown'}`);

    const deleteResults = [];
    const errors = [];

    // Delete files one by one (could be optimized with DeleteObjectsCommand for bulk)
    for (const key of keys) {
      try {
        console.log(`🗑️ Deleting S3 file: ${key}`);
        
        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key
        });

        await s3Client.send(deleteCommand);
        deleteResults.push({ key, status: 'deleted' });
        console.log(`✅ Deleted: ${key}`);
        
      } catch (error) {
        console.error(`❌ Failed to delete ${key}:`, error);
        errors.push({ key, error: error.message });
      }
    }

    const response = {
      bucket: BUCKET_NAME,
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

  } catch (error) {
    console.error('❌ S3 delete operation failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete S3 files',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Optional: Add bulk delete support for better performance
export async function DELETE(request: NextRequest) {
  try {
    const { keys, tourTitle } = await request.json();

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'No file keys provided' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Bulk deleting ${keys.length} S3 files for tour: ${tourTitle || 'Unknown'}`);

    // S3 supports bulk delete up to 1000 objects at once
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false // Get detailed response
      }
    });

    const result = await s3Client.send(deleteCommand);

    const response = {
      bucket: BUCKET_NAME,
      tourTitle,
      deleted: result.Deleted || [],
      errors: result.Errors || [],
      summary: {
        total: keys.length,
        successful: (result.Deleted || []).length,
        failed: (result.Errors || []).length
      }
    };

    console.log(`✅ Bulk delete completed: ${response.summary.successful}/${response.summary.total} files deleted`);

    return NextResponse.json({
      message: 'Bulk delete completed',
      ...response
    });

  } catch (error) {
    console.error('❌ S3 bulk delete operation failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to bulk delete S3 files',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
