# Quick Start: Supabase Setup

Get Sonic Walkscape running with Supabase Storage in 5 minutes.

## 1. Create Supabase Project (2 min)

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Enter:
   - Name: `sonic-walkscape`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Click **"Create new project"** and wait ~2 minutes

## 2. Create Storage Bucket (1 min)

1. Click **"Storage"** in left sidebar
2. Click **"Create a new bucket"**
3. Enter:
   - Name: `walkscape-audio`
   - ✅ **Public bucket**: ON
4. Click **"Create bucket"**

## 3. Get Your Keys (1 min)

1. Click **Settings** (gear icon) → **API**
2. Copy these 3 values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click Reveal)

## 4. Configure Environment (1 min)

Create `.env.local` in your project root:

```bash
# Paste your values here:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
STORAGE_URL=storage://walkscape-audio/tours

# Keep your existing OpenAI key (if you have one):
OPENAI_API_KEY=sk-proj-...
```

## 5. Test It! (30 sec)

```bash
npm install
npm run dev
```

Open http://localhost:3000/api/s3/status

✅ **Success Response:**
```json
{
  "status": "success",
  "bucket": "walkscape-audio",
  "storageInfo": {
    "message": "Upload test successful"
  }
}
```

❌ **Error Response?** Check:
- Environment variables are correct
- No extra spaces in keys
- Bucket name is `walkscape-audio`
- Bucket is marked as **Public**

## That's It!

You're ready to:
- Upload audio files in `/cms`
- Play tours in `/player`
- Deploy to production

## Need Help?

- 📖 Full Setup: `SUPABASE_SETUP.md`
- 📖 Migration Details: `SUPABASE_MIGRATION_GUIDE.md`
- 📖 What Changed: `MIGRATION_COMPLETE.md`
- 💬 Supabase Discord: https://discord.supabase.com

## Deploy to Vercel

1. Push code to GitHub
2. Connect repo to Vercel
3. Add the same 4 environment variables
4. Deploy!

## Troubleshooting

### "STORAGE_URL not configured"
→ Check `.env.local` exists and has `STORAGE_URL=storage://walkscape-audio/tours`

### "Storage test failed"
→ Check service role key is correct (not anon key)

### Upload works but files can't be accessed
→ Ensure bucket is marked as **Public** in Supabase dashboard

---

**Total Setup Time**: ~5 minutes
**Cost**: Free (1GB storage included)
