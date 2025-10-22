#!/usr/bin/env node
// Verify Supabase storage has all tour files

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiwufyymymzuapbjatat.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_NqoH2TiN88z-jYMrharURw_KY59Ku5h';

const supabase = createClient(supabaseUrl, serviceKey);

async function verifyStorage() {
  console.log('🔍 Verifying Supabase Storage...\n');

  // List all files in tours folder
  const { data: files, error } = await supabase.storage
    .from('walkscape-audio')
    .list('tours', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('❌ Error listing files:', error.message);
    return;
  }

  console.log('📁 Files in Supabase Storage:');
  if (files.length === 0) {
    console.log('   (empty - no files uploaded yet)');
  } else {
    for (const file of files) {
      console.log(`   - ${file.name} (${(file.metadata?.size / 1024 / 1024).toFixed(2)} MB)`);

      // List contents of tour folders
      if (file.id) {
        const { data: tourFiles } = await supabase.storage
          .from('walkscape-audio')
          .list(`tours/${file.name}`, { limit: 100 });

        if (tourFiles) {
          for (const tf of tourFiles) {
            console.log(`     └─ ${tf.name}`);
          }
        }
      }
    }
  }

  console.log('\n✅ Storage verification complete');
  console.log(`📊 Total tour folders: ${files.length}`);
}

verifyStorage().catch(console.error);
