# Sonic Walkscape - Storage & Loading Architecture Documentation

Complete analysis of how tours, audio tracks, and subtitles are stored and loaded in the application.

---

## Documentation Files

### 1. STORAGE_ARCHITECTURE.md (Comprehensive)
**21KB - Full detailed analysis**

Contains:
- Complete tour data structure definition
- Audio file lifecycle with diagrams
- Player loading behavior and filtering
- Publish workflow documentation
- Multi-language support implementation
- GPS triggering mechanics
- localStorage quota management strategy
- S3 file deletion process
- Full integration point mapping
- Current limitations and issues

**Best for**: Understanding complete system, architectural decisions, implementation details

### 2. STORAGE_QUICK_REFERENCE.md (Quick Lookup)
**10KB - Quick reference guide**

Contains:
- Storage layers diagram
- Tour lifecycle flow chart
- Key decisions table
- Audio sources priority list
- Subtitle lookup hierarchy
- Storage optimization strategies
- Player tour filtering code
- S3 file structure example
- Environment variables reference
- API endpoints summary table
- Common issues and solutions
- Files to modify for migration

**Best for**: Quick lookups, reference during development, troubleshooting

---

## Quick Understanding

### The Three Storage Layers

```
Layer 3: AWS S3
└─ Published audio files (HTTP URLs)
   Example: https://bucket.s3.amazonaws.com/prefix/tour/locale/audio/region.mp3

Layer 2: Browser localStorage
└─ Key: WS_CMS_TOURS (array of tour objects)
   - Shared by CMS and Player
   - ~5-10MB size limit
   - Auto-optimized (removes large audio >2MB)

Layer 1: Memory
└─ React component state (temporary during session)
```

### The Core Data Path

```
1. CMS creates tour → localStorage WS_CMS_TOURS
2. User uploads audio → /api/upload/sign → S3 → track.audioUrl updated
3. User publishes → tour.published = true → localStorage saved
4. Player loads tours → filters published: true only
5. GPS triggers audio → playAudio(track.audioUrl or track.audioDataUrl)
6. Subtitles loaded → cmsTour.subtitles[locale][subtitleId]
```

---

## Key Files in Codebase

### CMS Interface
**File**: `app/cms/cms-content.tsx` (33KB)
- **Line 52**: Tour creation with `seedTour()`
- **Line 632**: Load tours from localStorage
- **Line 723**: `updateTour()` - main save mechanism
- **Line 862**: Add new tour
- **Line 1180**: `onUploadAudio()` - S3 upload workflow
- **Line 1402**: `onCreateSRTFromAudio()` - subtitle generation

### Player Interface
**File**: `app/player/player-content.tsx` (1415 lines)
- **Line 275**: `getCMSTours()` - load published tours
- **Line 339**: `convertCMSTourToPlayer()` - format conversion
- **Line 438**: GPS triggering logic
- **Line 580**: `playAudio()` - playback handler
- **Line 700**: Subtitle lookup and display

### S3 Integration
**File**: `app/api/upload/sign/route.ts`
- Generates presigned S3 upload URLs

**File**: `app/api/s3/status/route.ts`
- Tests S3 connection and credentials

**File**: `app/api/s3/delete/route.ts`
- Deletes S3 files with cleanup

---

## Critical Concepts

### 1. Published vs Unpublished
- **Published**: `tour.published = true` → visible in Player
- **Unpublished**: `tour.published = false` → hidden from Player
- **Storage**: Both stored in same localStorage key, filtered by Player

### 2. Audio Sources Priority
When playing audio, Player tries in order:
1. `track.audioDataUrl` (embedded/preview)
2. `track.audioUrl` (S3 HTTP URL - production)
3. Fallback lookup in CMS data
4. Tone generation (no audio available)

### 3. Subtitle Linking
Multiple matching strategies:
1. Direct: `track.subtitleId` reference
2. By region ID matching
3. By filename similarity
4. Fallback: first available subtitle

### 4. Multi-Language Tours
- Each locale stored as separate tour in WS_CMS_TOURS
- Same `slug` but different `id`, `locale`, `parentTourId`
- Player groups by `parentTourId` for language switching
- Separate tracks and subtitles per locale

---

## What Happens in Each Scenario

### Scenario 1: CMS User Creates Tour
```
1. Click "Add Tour" in CMS
2. seedTour() generates new tour with ID
3. localStorage updated with new tour
4. CMS displays editor for new tour
5. default: published = false (hidden from Player)
```

### Scenario 2: User Uploads Audio
```
1. Select audio file in CMS
2. /api/upload/sign → S3 presigned URL
3. PUT file to S3 URL
4. Get back: httpUrl (S3 HTTP) + S3 key
5. localStorage updated:
   - track.audioUrl = httpUrl
   - track.audioKey = S3 key
   - track.audioDataUrl removed (if was there)
```

### Scenario 3: CMS User Publishes Tour
```
1. Check "Publish" checkbox
2. tour.published = true
3. localStorage WS_CMS_TOURS updated
4. Next time Player refreshes:
   - Reads WS_CMS_TOURS
   - Filters: published = true
   - Tour appears in tour selector
```

### Scenario 4: Player User Enters GPS Region
```
1. GPS location within region radius
2. Player detects match
3. playAudio(track.audioUrl) called
4. Subtitles looked up and loaded
5. Audio plays with synced subtitles
6. Auto-stops when leaving region
```

---

## Integration Points for Shared Storage

### Current Implementation (localStorage)
```typescript
// Reading
const tours = localStorage.getItem('WS_CMS_TOURS');
const parsed = JSON.parse(tours);

// Writing
localStorage.setItem('WS_CMS_TOURS', JSON.stringify(tours));
```

### Migration to Shared Storage (API-based)
```typescript
// Reading
const response = await fetch('/api/tours');
const tours = await response.json();

// Writing
await fetch('/api/tours', {
  method: 'PUT',
  body: JSON.stringify(tours)
});
```

### Files to Update
1. **app/cms/cms-content.tsx**
   - Replace localStorage.getItem() → API fetch
   - Replace localStorage.setItem() → API mutation

2. **app/player/player-content.tsx**
   - Replace getCMSTours() → API fetch
   - Handle async data loading

3. **Create new API endpoints**
   - `/api/tours` - GET/POST/PUT/DELETE
   - `/api/tours/[id]` - GET/PATCH/DELETE
   - `/api/tours/[id]/publish` - PATCH

---

## Storage Size Considerations

### localStorage Limits
- Typical: 5-10MB per domain
- Sonic Walkscape tries to fit within this

### Current Optimization Strategy
```
1. Monitor size before saving
2. Remove audio >2MB (mark with audioRemovedDueToSize)
3. Keep all metadata
4. Fallback: Keep only essential fields (ID, title, regions)
```

### Size Breakdown Example
- 3 tours × ~500KB each = 1.5MB
- Audio data: Can grow to 4-8MB quickly
- Images: ~100KB per region image
- Subtitles: ~10-50KB per locale

---

## Environment Configuration

### Required
```bash
BUNDLES_S3_URL=s3://bucket-name/prefix
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```

### Optional
```bash
S3_PUBLIC_READ=1                  # Public read access
OPENAI_API_KEY=sk-proj-xxxxx      # Real subtitle transcription
```

---

## Troubleshooting Guide

### Tour doesn't appear in Player
- Check: `tour.published === true`
- Check: tour has `slug` and `title`
- Check: tour has `regions` array
- Solution: Publish tour in CMS

### Audio doesn't play
- Check: `track.audioUrl` is set OR `track.audioDataUrl` exists
- Check: S3 file exists (if using audioUrl)
- Check: Browser console for errors
- Solution: Re-upload audio to S3

### "localStorage quota exceeded" error
- Cause: Tour data too large
- Solution: S3 upload audio (removes from localStorage)
- Or: Delete unpublished tours

### Subtitles not showing
- Check: `track.subtitleId` references valid subtitle
- Check: Subtitle exists in `cmsTour.subtitles[locale]`
- Check: Subtitle has `content` field with SRT data
- Solution: Create SRT file, link to track

---

## Architecture Strengths

1. **Offline capable** - Works without internet for preview
2. **Fast** - Synchronous localStorage access
3. **Simple** - No database required initially
4. **Scalable audio** - S3 handles large files
5. **Multi-language** - Built-in locale support

## Architecture Limitations

1. **No versioning** - Updates overwrite without history
2. **No permissions** - Anyone can modify tours
3. **Browser-only** - Can't share between devices
4. **No sync** - Manual S3 file management
5. **Single checkbox publish** - No validation workflow

---

## Next Steps for Shared Storage

1. Design API schema for tours database
2. Create `/api/tours` endpoints
3. Add tour versioning capability
4. Implement publish validation workflow
5. Add user authentication/permissions
6. Create audit trail for changes
7. Add backup/recovery mechanisms

---

## Related Documentation

- **CLAUDE.md** - Project overview and architecture
- **S3_CONFIGURATION.md** - AWS S3 setup guide
- **SUBTITLE_GENERATION.md** - Subtitle generation details
- **README.md** - Quick start guide

---

**Created**: 2024-10-20
**Analyzed By**: Claude Code
**Focus**: Storage architecture, data flow, integration planning
**Status**: Current architecture documented, ready for evolution

