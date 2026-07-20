-- M5 Round 2 (part 3) — private storage bucket + object policies.
-- Kept SEPARATE from the table/seed migrations: if hosted Supabase rejects any
-- storage-schema statement, this migration fails alone and we stop and report
-- (agreed rule — no workarounds without review).
--
-- Bucket-level limits are the authoritative enforcement (15 MB, allowed mime
-- types); the app duplicates them client-side for friendly errors only.
-- Path convention: {case_id}/{upload_id}.{ext} — policies derive ownership from
-- the first path segment via the user's case.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-documents', 'case-documents', false, 15728640,
        ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "case-documents: own case read" ON storage.objects;
CREATE POLICY "case-documents: own case read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents'
         AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.cases WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "case-documents: own case insert" ON storage.objects;
CREATE POLICY "case-documents: own case insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents'
              AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.cases WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "case-documents: own case delete" ON storage.objects;
CREATE POLICY "case-documents: own case delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents'
         AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.cases WHERE user_id = auth.uid()));

COMMIT;
