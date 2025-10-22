# Sonic Walkscape Storage & Loading Architecture Analysis

## Executive Summary

Sonic Walkscape uses a **dual-tier storage system** with localStorage for tour manifests and management, OPFS/data URLs for preview content, and S3 for production deployment. The Player filters and loads only published tours from localStorage, while audio can come from OPFS (during creation), data URLs (embedded), or S3 HTTP URLs (published).

---

## 1. Tour Storage Locations

### 1.1 localStorage Keys

**Primary Key: `WS_CMS_TOURS`**
- **Purpose**: Central tour repository accessible by both CMS and Player
- **Content**: Array of tour objects with full metadata, tracks, and subtitles
- **Location**: Browser localStorage (shared across tabs)
- **Size Management**: Automatic optimization to prevent quota exceeded errors
  - Large audio files (>2MB) are removed and marked with `audioRemovedDueToSize: true`
  - Fallback: Store only essential data (metadata, small images, track references)
- **Access Pattern**: Direct JSON serialization/deserialization

**Preview Key: `WS_PREVIEW_MANIFEST`**
- **Purpose**: Preview mode for CMS testing before publishing
- **Content**: Single tour object used for previewing in Player
- **Used By**: Player component to show preview tours when present

### 1.2 Tour Data Structure

```typescript
interface Tour {
  id: string;                    // Unique identifier
  slug: string;                  // URL-friendly identifier
  title: string;                 // Display name
  description?: string;          // Tour description
  priceEUR?: number;             // Price (if applicable)
  published: boolean;            // Visibility flag
  locale: string;                // Primary language (e.g., 'it-IT')
  parentTourId?: string;         // For multi-language variants
  tourImageDataUrl?: string;     // Cover image (data URL)
  
  // Geospatial data
  regions: Array<{
    id: string;
    lat: number;
    lng: number;
    radiusM: number;             // Trigger radius in meters
    sort: number;                // Display order
    name?: string | Record<string, string>;
  }>;
  
  // Audio tracks per locale per region
  tracks: {
    [locale: string]: {
      [regionId: string]: {
        title?: string;
        description?: string;
        transcript?: string;
        frequency?: number;        // For tone-based audio
        kind?: 'tone' | 'audio';
        
        // Local/embedded audio
        audioDataUrl?: string;     // Base64 data URL (OPFS/preview)
        audioFilename?: string;
        audioRemovedDueToSize?: boolean;
        
        // S3 published audio
        audioUrl?: string;         // HTTP URL for playback
        audioKey?: string;         // S3 object key for management
        
        // Images
        imageDataUrl?: string;     // Data URL
        imageFilename?: string;
        imageKey?: string;
        
        // Subtitles
        subtitleId?: string;       // Reference to subtitle entry
      }
    }
  };
  
  // Subtitles per locale
  subtitles: {
    [locale: string]: {
      [subtitleId: string]: {
        id: string;
        name: string;
        content: string;           // SRT format
        language: string;
        createdAt: string;
        generatedFromAudio?: string;
        transcriptionSource?: 'openai-whisper' | 'fallback-client';
      }
    }
  };
  
  locales?: Array<{ code: string; title: string; description: string }>;
  vouchers?: any[];
}
```

---

## 2. Audio File Handling

### 2.1 Audio File Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ UPLOAD WORKFLOW                                                 │
└─────────────────────────────────────────────────────────────────┘

1. CMS User uploads audio file
   ↓
2. File converted to data URL (embedded in localStorage initially)
   ├── Can be played locally via playAudio(audioDataUrl)
   ├── Stored in OPFS (if available) for preview
   └── Size checked: >2MB triggers S3 upload
   ↓
3. S3 Upload (if file >2MB or user chooses to publish)
   ├── Call /api/upload/sign → presigned URL
   ├── PUT request with file to S3
   └── Receive httpUrl & S3 key
   ↓
4. Update track in localStorage
   ├── Set audioUrl = httpUrl (S3 HTTP URL)
   ├── Set audioKey = S3 key
   └── Remove audioDataUrl to save space
   ↓
5. PUBLISH: tour.published = true
   └── Player filters and shows tour
```

### 2.2 Audio Sources by Scenario

**During CMS Creation (Preview)**
- Source: `audioDataUrl` (base64 encoded data URL)
- Storage: localStorage (with size optimization)
- Playback: Direct audio element creation
- Example: `new Audio(dataUrl)`

**Before Publishing**
- Source: `audioDataUrl` (embedded in track)
- Storage: localStorage (optimized, large files removed)
- Access: CMS and Player preview modes

**After Publishing (Production)**
- Source: `audioUrl` (HTTP URL to S3)
- Storage: S3 bucket at `s3://bucket/prefix/{slug}/{locale}/audio/{regionId}.mp3`
- Playback: HTTP URL directly
- Example: `https://bucket.s3.amazonaws.com/prefix/tour-slug/it-IT/audio/region-id.mp3`

### 2.3 S3 URL Structure

**S3 Configuration**: Environment variable `BUNDLES_S3_URL`
- Format: `s3://bucket-name/optional-prefix`
- Example: `s3://gigiorda-walkspace/tours`

**File Path Pattern**:
```
{bucket}/{prefix}/{tour-slug}/{locale}/audio/{regionId}.{ext}
```

**Generated HTTP URL**:
```
https://{bucket}.s3.amazonaws.com/{prefix}/{tour-slug}/{locale}/audio/{regionId}.mp3
```

---

## 3. Player Loading Behavior

### 3.1 Tour Discovery

**Location**: `app/player/player-content.tsx` lines 275-306

```typescript
function getCMSTours() {
  const raw = localStorage.getItem('WS_CMS_TOURS');
  if (!raw) return null;
  
  const parsed = JSON.parse(raw);
  // CRITICAL: Filter only published tours
  const publishedTours = parsed.filter(tour => 
    tour.slug && 
    tour.title && 
    Array.isArray(tour.regions) &&
    tour.published === true  // <-- ONLY published tours appear
  );
  
  return publishedTours.length > 0 ? publishedTours : null;
}
```

**Key Points**:
- Only tours with `published: true` are visible to Player
- Tours must have: `slug`, `title`, `regions` array
- Unpublished tours in localStorage are ignored

### 3.2 Tour Conversion

**Location**: `app/player/player-content.tsx` lines 339-379

CMS tours are converted to Player format:
- Group tours by `parentTourId` to show language variants
- Extract locale from `tour.locale` or `tour.locales[0].code`
- Map CMS track structure to Player expectations
- Build `availableLanguages` list for language switching

### 3.3 Audio Loading During Playback

**Location**: `app/player/player-content.tsx` lines 580-641

```typescript
const playAudio = (audioSource: string, srtContent?: string) => {
  // audioSource can be:
  // 1. track.audioDataUrl (data URL from localStorage)
  // 2. track.audioUrl (HTTP URL from S3)
  // 3. cmsTrack.audioUrl (fallback from CMS lookup)
  
  const audio = new Audio(audioSource);
  audio.play()
    .catch(err => console.error('Playback failed:', err));
};
```

**Playback Sources (Priority)**:
1. `track.audioDataUrl` (embedded/OPFS)
2. `track.audioUrl` (S3 HTTP URL)
3. `cmsTrack.audioUrl` (fallback lookup from CMS data)
4. Fallback to tone generation if no audio available

### 3.4 Subtitle Loading

**Location**: `app/player/player-content.tsx` lines 700-815

Subtitle lookup hierarchy:
1. Check `track.subtitleId` → look in `cmsTour.subtitles[locale][subtitleId]`
2. If no ID, search by region ID matching
3. Try filename matching: `cmsTrack.audioFilename` vs subtitle name
4. Fallback: use first available subtitle in locale

---

## 4. Publish Workflow

### 4.1 Publishing Process (Current)

**CMS Publish Mechanism**: Simple flag toggle
- **Location**: `app/cms/cms-content.tsx` (Publish tab)
- **Implementation**: Single checkbox
  ```jsx
  onChange={(e) => updateTour((t: any) => { t.published = e.target.checked; })}
  ```

**What Happens on Publish**:
1. User checks `published` checkbox in CMS
2. Tour data updated in `updateTour()`
3. JSON serialized and saved to `WS_CMS_TOURS` in localStorage
4. **No automatic S3 upload** - audio must be uploaded separately first
5. Player immediately sees tour (next refresh)

### 4.2 S3 File Organization

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload/sign` | POST | Get presigned S3 upload URL |
| `/api/s3/status` | GET | Test S3 connection |
| `/api/s3/delete` | POST | Delete S3 files |

**Bundle Endpoints** (placeholder/mock):
- `/api/cms/bundles/build` - Mock bundle build
- `/api/cms/bundles/status` - Mock build progress
- `/api/bundles/[slug]/[locale]/manifest` - Serve manifest

### 4.3 Upload Workflow Detail

**Location**: `app/cms/cms-content.tsx` lines 1180-1248

```typescript
async function onUploadAudio(regionId: string, file: File) {
  // 1. Request presigned URL
  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    body: JSON.stringify({
      slug: tour.slug,
      locale: tour.locale || 'it-IT',
      regionId,
      fileName: file.name,
      contentType: file.type
    })
  });
  
  const { url: uploadUrl, httpUrl, key } = await signResponse.json();
  
  // 2. Upload to S3 using presigned URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });
  
  // 3. Update track with S3 URLs
  updateTour((t) => {
    t.tracks[locale][regionId].audioUrl = httpUrl;      // For playback
    t.tracks[locale][regionId].audioKey = key;          // For management
    delete t.tracks[locale][regionId].audioDataUrl;     // Clean up
  });
}
```

---

## 5. Multi-Language Support

### 5.1 Tour Variants

Tours can have multiple locale variants stored as separate documents:

```typescript
// In localStorage WS_CMS_TOURS array:
[
  {
    id: "tour-1-it",
    slug: "bandite-demo",
    locale: "it-IT",
    parentTourId: "tour-1",
    title: "BANDITE (Italiano)",
    published: true,
    tracks: { "it-IT": { ... } },
    subtitles: { "it-IT": { ... } }
  },
  {
    id: "tour-1-fr",
    slug: "bandite-demo",
    locale: "fr-FR",
    parentTourId: "tour-1",
    title: "BANDITE (Français)",
    published: true,
    tracks: { "fr-FR": { ... } },
    subtitles: { "fr-FR": { ... } }
  }
]
```

### 5.2 Player Language Switching

1. **Group tours by parentTourId** in Player
2. Show language options in dropdown
3. Switch tour when user selects different language
4. Load corresponding tracks and subtitles

**Supported Locales** (hardcoded):
- `it-IT` (Italian)
- `fr-FR` (French)
- Expandable via `LANG_CODES` array in cms-content.tsx

---

## 6. Data Flow Diagram

```
┌──────────────────────┐
│  CMS INTERFACE       │
│ app/cms/cms-content  │
└──────────┬───────────┘
           │ Create/Edit Tour
           ↓
   ┌───────────────────┐
   │  localStorage     │
   │ WS_CMS_TOURS      │
   │ (all tours)       │
   └───────┬───────────┘
           │
           ├─────────────────────┬──────────────────────┐
           │                     │                      │
     ┌─────┴──────┐      ┌──────┴────┐        ┌────────┴──────┐
     │ Audio Data │      │  Images   │        │  Subtitles    │
     │ URLs       │      │ Data URLs │        │  (SRT)        │
     │ (embedded) │      │ (embedded)│        │               │
     └─────┬──────┘      └──────┬────┘        └────────┬──────┘
           │                    │                      │
           │ [Large audio]      │ [if needed]          │
           ├────────────────────┘                      │
           │                                           │
           ↓                                           │
   ┌───────────────┐                                  │
   │  /api/upload  │                                  │
   │     /sign     │                                  │
   └───────┬───────┘                                  │
           │                                           │
           ↓                                           │
   ┌────────────────────┐                            │
   │   AWS S3 Bucket    │◄───────────────────────────┘
   │ {slug}/{locale}    │
   │  /audio/...mp3     │
   │  /manifest.json    │
   └────────┬───────────┘
            │
            │ Published tours only
            │ tour.published = true
            │
            ├──────────────────────────────┬──────────────┐
            │                              │              │
      ┌─────┴────┐                   ┌────┴──┐    ┌─────┴───┐
      │           │                  │       │    │         │
   ┌──┴───────────┴──┐      ┌────────┴─┐   └────┴─────────┐
   │ PLAYER READS    │      │ Preview   │   │             │
   │ localStorage    │      │ (CMS)     │   │             │
   │ WS_CMS_TOURS    │      │ Shows all │   │             │
   │ (filter by      │      │ tours     │   │             │
   │  published:true)│      └───────────┘   │             │
   └──────┬──────────┘                       │             │
          │                                   │             │
          ├────────────────────────────┬─────┘             │
          │                            │                   │
    ┌─────┴──────────────┐    ┌────────┴───────┐         │
    │ Audio Playback     │    │ Subtitle       │         │
    │ Priority:          │    │ Sync           │         │
    │ 1. audioDataUrl    │    │ (SRT parsing)  │         │
    │ 2. audioUrl (S3)   │    │                │         │
    │ 3. Tone fallback   │    │                │         │
    └────────────────────┘    └────────────────┘         │
                                                           │
   ┌─────────────────────────────────────────────────────┘
   │
   └──→ User Location (GPS)
        ├─ Match region radius
        ├─ Auto-play audio
        └─ Show subtitles
```

---

## 7. Critical Implementation Details

### 7.1 GPS Triggering

**Location**: `app/player/player-content.tsx` lines 438-486

```typescript
navigator.geolocation.watchPosition((pos) => {
  const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  
  // Calculate distance to each region
  const enteredRegion = TOUR.regions.find((r) => {
    const distance = Math.sqrt(
      Math.pow(userPos.lat - r.center.lat, 2) + 
      Math.pow(userPos.lng - r.center.lng, 2)
    ) * 111000; // Rough conversion to meters
    return distance <= r.radiusM;
  });
  
  if (enteredRegion && enteredRegion.id !== activeRegionId) {
    stopAudio();
    playAudio(enteredRegion.track.audioUrl);
  }
});
```

### 7.2 localStorage Quota Management

**Strategy**: Proactive optimization to prevent quota exceeded errors

1. **Check file sizes** before saving
2. **Remove large audio** (>2MB) with marker flag
3. **Keep metadata** for reference
4. **Fallback**: Save essential data only
   - Preserve tour structure
   - Keep small images
   - Remove large audio
   - Keep track metadata

**Location**: `app/cms/cms-content.tsx` lines 740-860

### 7.3 S3 File Deletion

**Endpoint**: `/api/s3/delete` (POST and DELETE methods)

Supports:
- Individual file deletion
- Bulk deletion (up to 1000 files)
- Deletion tracking per tour

**Location**: `app/cms/cms-content.tsx` lines 882-940+ (tour deletion)

---

## 8. Current Limitations

### 8.1 Publishing System Issues

1. **No atomic publish** - Publish flag set independently of audio uploads
2. **No validation** - Can publish tour without audio files
3. **No versioning** - Updates overwrite without history
4. **No sync mechanism** - S3 files not automatically tracked

### 8.2 Storage Inefficiencies

1. **localStorage duplication** - Audio data stored in both CMS and Player keys
2. **No compression** - SRT content stored as plain text
3. **No deduplication** - Same audio/images duplicated across tours
4. **Size limits** - localStorage typically 5-10MB per domain

### 8.3 Access Control

1. **No authentication** - Anyone can modify tours
2. **No permissions** - No role-based access control
3. **No audit trail** - Changes not tracked

---

## 9. Key Files Reference

| File | Purpose | Key Functions |
|------|---------|---|
| `app/cms/cms-content.tsx` | CMS UI & tour management | `seedTour()`, `updateTour()`, `onUploadAudio()`, `onUploadSRT()` |
| `app/player/player-content.tsx` | Player UI & playback | `getCMSTours()`, `convertCMSTourToPlayer()`, `playAudio()`, `parseSRT()` |
| `app/api/upload/sign/route.ts` | S3 presigned URLs | S3 file upload permission |
| `app/api/s3/status/route.ts` | S3 connection test | Verify AWS credentials |
| `app/api/s3/delete/route.ts` | S3 file deletion | Cleanup tour files |
| `app/api/cms/bundles/build/route.ts` | Bundle build (mock) | Not implemented |
| `app/api/bundles/.../manifest/route.ts` | Manifest endpoint | Tour metadata delivery |

---

## 10. Integration Points for Shared Storage

### 10.1 Where Tours are Read
1. **Player component** - `getCMSTours()` at load time
2. **CMS component** - localStorage load in `useEffect`
3. **Preview mode** - Preview tour display

### 10.2 Where Tours are Written
1. **CMS updateTour()** - Main write path
2. **CMS addTour()** - Tour creation
3. **CMS deleteTour()** - Tour deletion
4. **Audio upload** - Updates track metadata

### 10.3 Proposed Shared Storage Integration Points
- Replace `localStorage.getItem('WS_CMS_TOURS')` with API call
- Replace `localStorage.setItem('WS_CMS_TOURS')` with API mutations
- Implement tour versioning at API level
- Add publish workflow validation
- Centralize subtitle management
