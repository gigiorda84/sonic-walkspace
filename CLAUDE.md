# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sonic Walkscape is a GPS-triggered audio walking tour application built with Next.js. It features:
- **CMS Interface** (`/cms`) for creating and managing audio tours with multi-language support
- **Player Interface** (`/player`) for experiencing GPS-triggered audio tours with interactive maps
- **S3 Integration** for storing and serving audio files via AWS S3
- **Subtitle Generation** using OpenAI Whisper API with intelligent fallback system
- **OPFS Storage** for local file caching and offline preview

## Key Commands

### Development
```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Build production bundle
npm start            # Start production server
npm run lint         # Run ESLint (continues on error with || true)
```

### Testing
```bash
npm run test:s3      # Test S3 connection and credentials (scripts/test-s3.js)
```

### Access Points
- CMS: `http://localhost:3000/cms`
- Player: `http://localhost:3000/player`

## Architecture

### Data Flow & Storage Strategy

**Dual Storage System:**
1. **LocalStorage** - Stores tour manifests, CMS data, and settings
2. **OPFS (Origin Private File System)** - Stores audio files for offline access and preview
3. **AWS S3** - Production storage for published audio files

**Tour Lifecycle:**
```
CMS Create Tour → LocalStorage (draft) → Upload Audio → OPFS (preview) → Publish → S3 (production)
                                                       ↓
                                           Player reads from LocalStorage + OPFS/S3
```

### Component Architecture

**CMS (`/app/cms/cms-content.tsx`)**
- Multi-tab interface: Tours, Regions, Tracks, Subtitles, Publish, Vouchers
- Manages tour metadata, GPS regions, audio tracks per locale, and subtitle files
- Uses OPFS for local audio file storage before S3 upload
- Tours stored in `localStorage` under key `WS_CMS_TOURS`

**Player (`/app/player/player-content.tsx`)**
- Reads published tours from `localStorage` key `WS_CMS_TOURS` (filters `published: true`)
- GPS-based audio triggering using `navigator.geolocation.watchPosition()`
- Dynamic map loading (Leaflet/react-leaflet) with multiple tile layers
- Audio playback with subtitle synchronization (SRT format)
- Modal navigation for browsing tour regions

**Key Data Structures:**
```typescript
Tour: {
  id, slug, title, description, published, locale, parentTourId,
  regions: [{ id, lat, lng, radiusM, sort }],
  tracks: { [locale]: { [regionId]: { audioDataUrl, subtitleId, ... } } },
  subtitles: { [locale]: { [subtitleId]: { content, name } } }
}
```

### API Routes

**S3 Management:**
- `/api/upload/sign` - Generate presigned URLs for S3 uploads (PUT requests)
- `/api/s3/status` - Test S3 connection and credentials
- `/api/s3/delete` - Delete files from S3

**Subtitle Generation:**
- `/api/transcribe` - Convert audio to SRT subtitles
  - Primary: OpenAI Whisper API (requires `OPENAI_API_KEY`)
  - Fallback: Intelligent mock generation based on audio duration
  - Returns SRT format with `{ id, startTime, endTime, text }`

**Bundle Management:**
- `/api/cms/bundles/build` - Build tour bundles for deployment
- `/api/cms/bundles/status` - Check bundle build status
- `/api/bundles/[slug]/[locale]/manifest` - Serve tour manifests
- `/api/bundles/[slug]/[locale]/file` - Serve tour files

### Environment Configuration

Required variables in `.env.local`:

```bash
# S3 Configuration (format: s3://bucket-name/prefix)
BUNDLES_S3_URL=s3://bucket-name/prefix

# AWS Credentials
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Optional: Make uploaded files publicly readable
S3_PUBLIC_READ=1

# Optional: OpenAI for subtitle generation
OPENAI_API_KEY=sk-proj-...
```

**S3 File Structure:**
```
bucket/
└── prefix/
    └── {tour-slug}/
        └── {locale}/
            └── audio/
                └── {regionId}.mp3
```

## Critical Implementation Details

### LocalStorage Usage
- **Critical:** Tours can be large. The CMS uses aggressive compression and cleanup strategies
- Tours are filtered client-side: only `published: true` tours appear in Player
- Use `WS_CMS_TOURS` key for tour array, `WS_PREVIEW_MANIFEST` for preview tour

### GPS & Audio Triggering
Located in `app/player/player-content.tsx:438-486`:
- Distance calculation uses rough lat/lng to meters conversion (`* 111000`)
- Triggers when user enters region radius (`distance <= r.radiusM`)
- Auto-stops previous audio before playing new region audio

### Map Layer System
Player supports multiple map tile providers (streets, satellite, terrain, dark mode):
- Configured in `mapLayers` object (player-content.tsx:122-144)
- Dynamic layer switching via LayerSwitcher component
- Leaflet loaded dynamically client-side only

### Subtitle Synchronization
- SRT parsing: `parseSRT()` converts `HH:MM:SS,mmm` format to `{ startSeconds, endSeconds }`
- Real-time sync: `getCurrentSubtitle()` matches `currentTime` to subtitle entries
- Display updates every 100ms during playback

### S3 URL Parsing
Helper function `parseS3()` in API routes:
```javascript
parseS3("s3://bucket/prefix")
  → { bucket: "bucket", prefix: "prefix" }
```

### Client-Side Feature Detection
Always check `IS_CLIENT = typeof window !== "undefined"` before accessing:
- `localStorage`, `navigator.geolocation`, `AudioContext`
- OPFS: `(navigator as any)?.storage?.getDirectory`

## Common Development Patterns

**Adding a new locale:**
1. Update `LANG_CODES` array in cms-content.tsx
2. Add locale option in CMS locale selection
3. Create tracks/subtitles for new locale in tour data structure

**Adding a new API route:**
1. Create in `app/api/{feature}/route.ts`
2. Export `GET` or `POST` function returning `NextResponse.json()`
3. Parse S3 URL using `parseS3()` helper if S3-related

**Modifying tour data structure:**
1. Update type definitions (inline in cms-content.tsx and player-content.tsx)
2. Update `convertCMSTourToPlayer()` in player-content.tsx
3. Test localStorage migration for existing tours

**Working with audio files:**
- CMS: Store in OPFS first for preview, then upload to S3 on publish
- Player: Try OPFS first, fallback to S3 HTTP URLs
- Always handle both `audioDataUrl` (OPFS/data URL) and `audioUrl` (HTTP)

## Configuration Files

- `next.config.js` - Next.js configuration (not present, uses defaults)
- `tsconfig.json` - TypeScript config (strict mode disabled, ESNext target)
- `tailwind.config.js` - Tailwind CSS configuration
- `.env.local` - Environment variables (gitignored, use `.env.example` as template)

## Documentation References

For detailed setup and configuration:
- `S3_CONFIGURATION.md` - AWS S3 setup, IAM policies, bucket configuration
- `SUBTITLE_GENERATION.md` - OpenAI Whisper integration, SRT format, fallback system
- `README.md` - Quick start guide (in Italian)
