
# Sonic Walkscape — Next.js (CMS + Player + S3 Upload)

## Setup
1) `cp .env.example .env.local` e inserisci le tue credenziali AWS
2) `npm i`
3) `npm run dev`

- CMS:    http://localhost:3000/cms
- Player: http://localhost:3000/player

### Upload su S3
Nel CMS, quando carichi un MP3, il file viene:
- salvato in locale (OPFS) per anteprima/offline immediata
- caricato su S3 tramite presigned PUT se `.env.local` è configurato

Gli URL pubblici risultano: `https://<bucket>.s3.amazonaws.com/<prefix>/<slug>/<locale>/audio/<regionId>.mp3`
