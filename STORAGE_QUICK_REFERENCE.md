# Sonic Walkscape Storage Architecture - Quick Reference

## Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: S3 (Production)                                    │
│ - Published audio files (HTTP URLs)                         │
│ - Format: s3://bucket/prefix/{slug}/{locale}/audio/{id}.mp3 │
│ - Access: HTTP URLs for streaming playback                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: localStorage (Browser)                             │
│ - Key: WS_CMS_TOURS                                         │
│ - Content: Array of tour objects with all metadata          │
│ - Size: ~5-10MB limit with optimization                     │
│ - Access: Synchronous JSON read/write                       │
│ - Shared: Both CMS and Player read from same key            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Memory / Components                                │
│ - React state (tours, selectedTour, etc.)                   │
│ - Audio elements (HTMLAudioElement)                         │
│ - Subtitle data (parsed SRT)                                │
└─────────────────────────────────────────────────────────────┘
```

## Critical Data Paths

### Tour Lifecycle

```
1. CREATE (CMS)
   ├─ generateTourId()
   ├─ Save to WS_CMS_TOURS
   ├─ Set published: false (default)
   └─ Show in CMS editor

2. EDIT (CMS)
   ├─ Update fields in component state
   ├─ Save to WS_CMS_TOURS (auto-save on updateTour)
   ├─ Optimize: Remove large audio >2MB
   └─ Fallback: Keep metadata only if quota exceeded

3. UPLOAD AUDIO (CMS)
   ├─ Convert file → audioDataUrl (data URL)
   ├─ Call /api/upload/sign → presigned S3 URL
   ├─ PUT file to S3 → get httpUrl
   ├─ Update track: audioUrl = httpUrl, audioKey = S3 key
   ├─ Remove audioDataUrl from localStorage
   └─ Save to WS_CMS_TOURS

4. PUBLISH (CMS)
   ├─ Set published: true
   ├─ Save to WS_CMS_TOURS
   └─ Player filters and shows tour (on refresh)

5. LOAD (Player)
   ├─ Read WS_CMS_TOURS from localStorage
   ├─ Filter: published: true only
   ├─ Group by parentTourId for language variants
   ├─ Convert CMS format to Player format
   └─ Ready for GPS triggering

6. PLAYBACK (Player)
   ├─ User enters region (GPS match)
   ├─ playAudio(audioSource) called
   ├─ Try: audioDataUrl → audioUrl → tone
   ├─ Create Audio element with source
   ├─ Load subtitles from cmsTour.subtitles[locale]
   ├─ Parse SRT → display sync with playback
   └─ Auto-stop on region exit
```

## Key Decisions

| Decision | Impact | Trade-off |
|----------|--------|-----------|
| localStorage for CMS state | Synchronous access, no server needed | Limited to 5-10MB, browser-only |
| Dual keys (WS_CMS_TOURS + WS_PREVIEW_MANIFEST) | Preview isolated from published | Duplication, more storage used |
| Filter published: true in Player | Unpublished tours hidden | Requires tour.published = true |
| Auto-remove audio >2MB | Prevent quota exceeded | Risk of data loss if not uploaded to S3 |
| S3 HTTP URLs for audio | CDN-friendly, scalable | Requires CORS, external dependency |
| SRT format for subtitles | Standard, wide tool support | Text-based, not compressed |
| Presigned URLs for upload | Secure, time-limited | Server-side generation required |

## Audio Sources (Priority)

```
When playing audio from a region:

1st Choice: track.audioDataUrl
├─ Usage: During CMS creation (preview)
├─ Format: data:audio/mpeg;base64,...
├─ Storage: localStorage
└─ Benefit: Instant playback, offline ready

2nd Choice: track.audioUrl
├─ Usage: After S3 upload / Published tours
├─ Format: https://bucket.s3.amazonaws.com/.../...mp3
├─ Storage: S3
└─ Benefit: Scalable, no localStorage size limit

3rd Choice: cmsTrack lookup
├─ Usage: Fallback from CMS data
├─ Format: Varies based on data available
├─ Storage: localStorage
└─ Benefit: Recovery if track structure damaged

4th Choice: Tone generation
├─ Usage: No audio available
├─ Format: Web Audio API oscillator
├─ Storage: Generated in-memory
└─ Benefit: Guaranteed some audio output
```

## Subtitle Lookup Hierarchy

```
Player looks for subtitles in this order:

1. track.subtitleId → cmsTour.subtitles[locale][subtitleId]
   └─ Direct reference (preferred)

2. Match by regionId
   ├─ Check sub.regionId === region.id
   ├─ Check sub.id === region.id
   ├─ Check sub.name === region.id
   └─ Check subtitleId === region.id

3. Match by filename
   ├─ cmsTrack.audioFilename vs sub.name
   └─ Case-insensitive substring match

4. Fallback
   ├─ Use first available subtitle in locale
   └─ If still nothing, empty subtitles
```

## Storage Optimization Strategies

### Size Management
```
1. Proactive Monitoring
   ├─ Calculate JSON size before save
   ├─ Log data size and tour count
   └─ Warn if > 4MB

2. Audio Optimization
   ├─ Remove files > 2MB: audioRemovedDueToSize = true
   ├─ Keep audioFilename for reference
   └─ Mark for re-upload to S3

3. Fallback (Quota Exceeded)
   ├─ Keep: ID, title, description, slug, published
   ├─ Keep: Regions (no audio)
   ├─ Keep: Track metadata (no audioDataUrl)
   ├─ Keep: Small images (< 1MB)
   └─ Remove: Large audio, SRT content
```

## Player Tour Filtering Logic

```javascript
// From app/player/player-content.tsx lines 275-306
function getCMSTours() {
  const raw = localStorage.getItem('WS_CMS_TOURS');
  if (!raw) return null;
  
  const parsed = JSON.parse(raw);
  const publishedTours = parsed.filter(tour => 
    tour &&
    tour.slug &&              // Must have slug
    tour.title &&             // Must have title
    Array.isArray(tour.regions) &&
    tour.published === true   // MUST be published
  );
  
  return publishedTours.length > 0 ? publishedTours : null;
}
```

## S3 File Structure

```
Bucket: gigiorda-walkspace (or configured)

Directory Layout:
s3://bucket/
├── prefix/                  (optional, from BUNDLES_S3_URL)
│   └── {tour-slug}/
│       └── {locale}/
│           ├── audio/
│           │   ├── {regionId}.mp3
│           │   ├── {regionId}.wav
│           │   └── ...
│           ├── images/
│           │   ├── {regionId}.jpg
│           │   └── ...
│           └── manifest.json

Example:
s3://gigiorda-walkspace/tours/bandite-demo/it-IT/audio/reg-1.mp3
https://gigiorda-walkspace.s3.amazonaws.com/tours/bandite-demo/it-IT/audio/reg-1.mp3
```

## Environment Variables

```bash
# S3 Configuration
BUNDLES_S3_URL=s3://bucket-name/optional-prefix

# AWS Credentials
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx

# Optional Settings
S3_PUBLIC_READ=1                  # Make files publicly readable
OPENAI_API_KEY=sk-proj-xxxxx      # For real subtitle generation
```

## API Endpoints Summary

| Path | Method | Purpose | Input | Output |
|------|--------|---------|-------|--------|
| `/api/upload/sign` | POST | Get S3 presigned URL | slug, locale, regionId, fileName | url, httpUrl, key |
| `/api/s3/status` | GET | Test S3 connection | - | status, bucket, config |
| `/api/s3/delete` | POST | Delete S3 files | keys[], tourTitle | deleted[], errors[] |
| `/api/cms/bundles/build` | POST | Build bundle (mock) | - | jobId |
| `/api/cms/bundles/status` | GET | Check build status | started | state, progress |
| `/api/bundles/[slug]/[locale]/manifest` | GET | Get manifest | slug, locale | version, url |
| `/api/transcribe` | POST | Generate subtitles | audio file + language | entries[], source |

## Multi-Language Implementation

```typescript
// Tours stored separately by locale
WS_CMS_TOURS: [
  { id: "tour-1-it", locale: "it-IT", parentTourId: "tour-1", ... },
  { id: "tour-1-fr", locale: "fr-FR", parentTourId: "tour-1", ... },
]

// Player groups by parentTourId
availableLanguages: [
  { code: "it-IT", title: "BANDITE (IT)", tourId: "tour-1-it" },
  { code: "fr-FR", title: "BANDITE (FR)", tourId: "tour-1-fr" }
]

// User switches language → Player loads different tour
onLanguageChange('fr-FR') 
  → finds tour with tourId: "tour-1-fr"
  → loads fr-FR tracks and subtitles
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "localStorage quota exceeded" | Large audio files | S3 upload audio, remove dataUrl |
| Tour not showing in Player | published: false | Check publish checkbox in CMS |
| Audio not playing | No audioUrl or audioDataUrl | Upload audio file to S3 |
| Subtitles not syncing | subtitleId mismatch | Link subtitle to region/track |
| Image not loading | Data URL too large | Compress image, use <1MB |

## Files to Modify for Shared Storage Migration

```
Core Files:
├─ app/cms/cms-content.tsx
│  ├─ Replace: localStorage.getItem('WS_CMS_TOURS')
│  ├─ With: await fetch('/api/tours')
│  ├─ Replace: localStorage.setItem('WS_CMS_TOURS')
│  └─ With: await fetch('/api/tours', { method: 'PUT' })
│
├─ app/player/player-content.tsx
│  ├─ Replace: getCMSTours() → fetch
│  └─ Handle async data loading
│
└─ app/api/
   ├─ New: /api/tours (GET/POST/PUT/DELETE)
   ├─ New: /api/tours/[id] (GET/PATCH/DELETE)
   └─ New: /api/tours/[id]/publish (PATCH)

Support Files:
├─ Database schema (tours, regions, tracks, subtitles)
├─ API validation/middleware
├─ Tour versioning logic
└─ Publish workflow validation
```

---

Generated: 2024-10-20
Analysis Depth: Medium
Focus: Storage architecture, data flow, and integration points
