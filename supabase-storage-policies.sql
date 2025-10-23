-- Supabase Storage Policies for walkscape-audio bucket
-- Run these SQL commands in Supabase SQL Editor

-- 1. Allow public READ access (already set if bucket is public, but let's be explicit)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'walkscape-audio' );

-- 2. Allow ANYONE to upload files (INSERT)
-- This is needed for anonymous uploads from the CMS
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'walkscape-audio' );

-- 3. Allow ANYONE to update/overwrite files (UPDATE)
-- This is needed when using upsert: true
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'walkscape-audio' )
WITH CHECK ( bucket_id = 'walkscape-audio' );

-- 4. Allow ANYONE to delete files (DELETE) - optional, only if you want public delete
-- Uncomment if needed:
-- CREATE POLICY "Public Delete"
-- ON storage.objects FOR DELETE
-- USING ( bucket_id = 'walkscape-audio' );

-- Alternative: If you want more security, restrict uploads to authenticated users only
-- Replace the "Public Upload" policy above with this:
/*
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'walkscape-audio' );

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'walkscape-audio' )
WITH CHECK ( bucket_id = 'walkscape-audio' );
*/
