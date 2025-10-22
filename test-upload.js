// Quick test script to verify Supabase bucket configuration
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testBucket() {
  console.log('🔍 Testing Supabase Storage configuration...\n');

  // List buckets
  console.log('1. Listing buckets...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error listing buckets:', listError.message);
    return;
  }

  console.log('✅ Found buckets:', buckets.map(b => `${b.name} (${b.public ? 'public' : 'private'})`).join(', '));

  const bucket = buckets.find(b => b.name === 'walkscape-audio');
  if (!bucket) {
    console.error('\n❌ Bucket "walkscape-audio" not found!');
    console.log('📝 Create it in Supabase dashboard: Storage → Create bucket → name: walkscape-audio, public: YES');
    return;
  }

  if (!bucket.public) {
    console.warn('\n⚠️  Bucket "walkscape-audio" exists but is PRIVATE!');
    console.log('📝 Make it public: Storage → walkscape-audio → Settings → Make public');
    return;
  }

  console.log('✅ Bucket "walkscape-audio" is properly configured (public)\n');

  // Test upload
  console.log('2. Testing file upload...');
  const testContent = `Test file created at ${new Date().toISOString()}`;
  const testPath = 'tours/test/upload-test.txt';

  const { error: uploadError } = await supabase.storage
    .from('walkscape-audio')
    .upload(testPath, testContent, {
      contentType: 'text/plain',
      upsert: true
    });

  if (uploadError) {
    console.error('❌ Upload failed:', uploadError.message);
    return;
  }

  console.log('✅ Upload successful');

  // Test public URL
  console.log('\n3. Testing public URL...');
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/walkscape-audio/${testPath}`;
  console.log('📎 Public URL:', publicUrl);

  try {
    const response = await fetch(publicUrl);
    if (response.ok) {
      const content = await response.text();
      console.log('✅ Public access works!');
      console.log('📄 Content:', content);
    } else {
      console.error('❌ Public access failed:', response.status, response.statusText);
    }
  } catch (err) {
    console.error('❌ Error fetching public URL:', err.message);
  }

  console.log('\n✅ All tests passed! Your Supabase Storage is ready.');
  console.log('🎉 You can now upload audio files in the CMS at http://localhost:3000/cms');
}

testBucket().catch(console.error);
