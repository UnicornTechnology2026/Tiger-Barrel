-- Storage bucket and policies for outlet photos
-- Run this in Supabase SQL Editor after creating the bucket via Dashboard
-- or use the Storage API.

-- Create bucket (if not exists via dashboard):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'outlet-photos',
--   'outlet-photos',
--   false,
--   5242880,
--   ARRAY['image/jpeg', 'image/png', 'image/webp']
-- );

-- Agents can upload to their own folder
CREATE POLICY "Agents can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'outlet-photos'
  AND (storage.foldername(name))[1] = 'agents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Agents can read their own photos
CREATE POLICY "Agents can read own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'outlet-photos'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Agents can delete their own photos (optional)
CREATE POLICY "Agents can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'outlet-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Admins full access
CREATE POLICY "Admins full storage access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'outlet-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
