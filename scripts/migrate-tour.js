#!/usr/bin/env node
// Migrate "Presenti Mai Assenti" tour to Supabase Storage

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiwufyymymzuapbjatat.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_NqoH2TiN88z-jYMrharURw_KY59Ku5h';

const supabase = createClient(supabaseUrl, serviceKey);

// This would normally come from localStorage, but we'll use the API to get uploaded files
async function listTourFiles() {
  console.log('🔍 Listing files in Supabase Storage...\n');

  const { data: folders, error } = await supabase.storage
    .from('walkscape-audio')
    .list('tours', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📁 Tour folders found:');
  for (const folder of folders) {
    console.log(`\n  ${folder.name}/`);

    // List locales
    const { data: locales } = await supabase.storage
      .from('walkscape-audio')
      .list(`tours/${folder.name}`, { limit: 100 });

    if (locales) {
      for (const locale of locales) {
        console.log(`    ${locale.name}/`);

        // List audio files
        const { data: audioFiles } = await supabase.storage
          .from('walkscape-audio')
          .list(`tours/${folder.name}/${locale.name}/audio`, { limit: 100 });

        if (audioFiles && audioFiles.length > 0) {
          for (const audio of audioFiles) {
            console.log(`      - ${audio.name} (${(audio.metadata?.size / 1024 / 1024).toFixed(2) || '?'} MB)`);
          }
        }
      }
    }
  }

  return folders;
}

async function createTourManifest(tourSlug) {
  console.log(`\n📝 Creating manifest for tour: ${tourSlug}`);

  // Example tour structure based on "Presenti Mai Assenti"
  const tour = {
    id: 'presenti-mai-assenti',
    slug: 'presenti-mai-assenti',
    title: 'Presenti Mai Assenti',
    description: 'Tour audio geolocallizzato',
    published: true,
    priceEUR: 0,
    locale: 'it-IT',
    locales: [
      {
        code: 'it-IT',
        title: 'Presenti Mai Assenti (IT)',
        description: 'Passeggiata sonora geolocalizzata'
      }
    ],
    regions: [
      { id: 'region-1', lat: 45.0749, lng: 7.6774, radiusM: 120, sort: 1 },
      { id: 'region-2', lat: 45.0705, lng: 7.6868, radiusM: 120, sort: 2 },
      { id: 'region-3', lat: 45.0567, lng: 7.6861, radiusM: 140, sort: 3 }
    ],
    tracks: {},
    subtitles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // List audio files to populate tracks
  const { data: audioFiles } = await supabase.storage
    .from('walkscape-audio')
    .list(`tours/${tourSlug}/it-IT/audio`, { limit: 100 });

  if (audioFiles && audioFiles.length > 0) {
    tour.tracks['it-IT'] = {};

    for (const audio of audioFiles) {
      const regionId = audio.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const audioUrl = `${supabaseUrl}/storage/v1/object/public/walkscape-audio/tours/${tourSlug}/it-IT/audio/${audio.name}`;

      tour.tracks['it-IT'][regionId] = {
        audioUrl: audioUrl,
        audioKey: `tours/${tourSlug}/it-IT/audio/${audio.name}`,
        audioFilename: audio.name
      };

      console.log(`  ✅ Added track: ${regionId} -> ${audio.name}`);
    }
  }

  return tour;
}

async function uploadTourManifest(tour) {
  console.log(`\n📤 Uploading manifest for: ${tour.slug}`);

  const manifestPath = `tours/${tour.slug}/manifest.json`;
  const manifestContent = JSON.stringify(tour, null, 2);

  const { data, error } = await supabase.storage
    .from('walkscape-audio')
    .upload(manifestPath, manifestContent, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    console.error('❌ Upload error:', error.message);
    return false;
  }

  console.log(`✅ Manifest uploaded: ${manifestPath}`);
  console.log(`🔗 URL: ${supabaseUrl}/storage/v1/object/public/walkscape-audio/${manifestPath}`);

  return true;
}

async function updateTourIndex(tour) {
  console.log('\n📋 Updating tour index...');

  const indexPath = 'tours/index.json';
  let index = { tours: [] };

  // Try to get existing index
  const { data: existingData, error: downloadError } = await supabase.storage
    .from('walkscape-audio')
    .download(indexPath);

  if (!downloadError && existingData) {
    const text = await existingData.text();
    index = JSON.parse(text);
  }

  // Add or update tour in index
  const existingIndex = index.tours.findIndex(t => t.slug === tour.slug);
  const tourSummary = {
    slug: tour.slug,
    title: tour.title,
    description: tour.description,
    priceEUR: tour.priceEUR || 0,
    locales: tour.locales,
    published: true,
    updatedAt: new Date().toISOString(),
    manifestUrl: `tours/${tour.slug}/manifest.json`
  };

  if (existingIndex >= 0) {
    index.tours[existingIndex] = tourSummary;
    console.log('  ♻️  Updated existing tour in index');
  } else {
    index.tours.push(tourSummary);
    console.log('  ✨ Added new tour to index');
  }

  // Upload updated index
  const { error: uploadError } = await supabase.storage
    .from('walkscape-audio')
    .upload(indexPath, JSON.stringify(index, null, 2), {
      contentType: 'application/json',
      upsert: true
    });

  if (uploadError) {
    console.error('❌ Index upload error:', uploadError.message);
    return false;
  }

  console.log('✅ Tour index updated');
  return true;
}

async function migrateTour() {
  console.log('🚀 Starting tour migration to Supabase Storage\n');
  console.log('═'.repeat(60));

  // Step 1: List existing files
  const folders = await listTourFiles();

  if (!folders || folders.length === 0) {
    console.log('\n⚠️  No tour folders found. Upload audio files first.');
    return;
  }

  // Step 2: Find the tour folder (try common variations)
  const tourFolder = folders.find(f =>
    f.name.toLowerCase().includes('presenti') ||
    f.name.toLowerCase().includes('tour-') ||
    f.name.toLowerCase().includes('1757')
  );

  if (!tourFolder) {
    console.log('\n⚠️  Could not find tour folder. Available folders:');
    folders.forEach(f => console.log(`  - ${f.name}`));
    return;
  }

  const tourSlug = tourFolder.name;
  console.log(`\n🎯 Found tour folder: ${tourSlug}`);
  console.log('═'.repeat(60));

  // Step 3: Create manifest
  const tour = await createTourManifest(tourSlug);

  // Step 4: Upload manifest
  const manifestUploaded = await uploadTourManifest(tour);
  if (!manifestUploaded) {
    console.error('\n❌ Failed to upload manifest');
    return;
  }

  // Step 5: Update index
  const indexUpdated = await updateTourIndex(tour);
  if (!indexUpdated) {
    console.error('\n❌ Failed to update index');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Migration complete!');
  console.log('═'.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`  Tour: ${tour.title}`);
  console.log(`  Slug: ${tour.slug}`);
  console.log(`  Regions: ${tour.regions.length}`);
  console.log(`  Tracks: ${Object.keys(tour.tracks['it-IT'] || {}).length}`);
  console.log(`\n🔗 Public URLs:`);
  console.log(`  Manifest: ${supabaseUrl}/storage/v1/object/public/walkscape-audio/tours/${tourSlug}/manifest.json`);
  console.log(`  Index: ${supabaseUrl}/storage/v1/object/public/walkscape-audio/tours/index.json`);
  console.log('\n🎉 Tour is now available in production!');
}

migrateTour().catch(console.error);
