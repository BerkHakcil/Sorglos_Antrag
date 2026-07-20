'use server'

/**
 * M5 document upload actions. Security model: every action verifies the session
 * and derives the case from auth.uid(); uploads go DIRECT to Supabase Storage
 * via server-minted signed upload URLs (Vercel's ~4.5 MB body cap forbids
 * proxying 15 MB files), with the bucket's file_size_limit + allowed_mime_types
 * as the authoritative enforcement. App-side checks exist only for friendly
 * German errors. Downloads only via short-lived signed URLs. No public URLs.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession, getStaticContent } from '@/lib/dal'

const BUCKET = 'case-documents'
const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
const EXT_RE = /\.(pdf|jpe?g|png|heic|heif)$/i

async function ownCase() {
  const { userId } = await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('cases')
    .select('id, social_office_id')
    .eq('user_id', userId)
    .single()
  return { supabase, caseRow: data }
}

export type CreateUploadUrlResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string }

export async function createUploadUrlAction(input: {
  filename: string
  mimeType: string
  sizeBytes: number
}): Promise<CreateUploadUrlResult> {
  const content = await getStaticContent()
  const { supabase, caseRow } = await ownCase()
  if (!caseRow) return { ok: false, error: content.docsErrorGeneric }
  if (!ALLOWED_MIME.includes(input.mimeType) || !EXT_RE.test(input.filename))
    return { ok: false, error: content.docsErrorType }
  if (input.sizeBytes > MAX_BYTES) return { ok: false, error: content.docsErrorSize }

  const ext = input.filename.match(EXT_RE)![1].toLowerCase()
  const path = `${caseRow.id}/${crypto.randomUUID()}.${ext}`
  // User-scoped client: the storage RLS insert policy authorizes the path.
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, error: content.docsErrorGeneric }
  return { ok: true, path: data.path, token: data.token }
}

export type RecordUploadResult = { ok: true } | { ok: false; error: string }

export async function recordUploadAction(input: {
  path: string
  ruleId: string
  documentId: string
  subject: string
  instanceKey: string
  originalFilename: string
}): Promise<RecordUploadResult> {
  const content = await getStaticContent()
  const { supabase, caseRow } = await ownCase()
  if (!caseRow || !input.path.startsWith(`${caseRow.id}/`))
    return { ok: false, error: content.docsErrorGeneric }

  // Verify the object actually landed (PUT succeeded) and read its real size/type.
  const dir = caseRow.id
  const base = input.path.slice(dir.length + 1)
  const { data: objects, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(dir, { search: base })
  const obj = objects?.find((o) => o.name === base)
  if (listErr || !obj) return { ok: false, error: content.docsErrorGeneric }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('document_upload').insert({
    case_id: caseRow.id,
    rule_id: input.ruleId,
    document_id: input.documentId,
    subject: input.subject,
    instance_key: input.instanceKey,
    storage_path: input.path,
    original_filename: input.originalFilename,
    mime_type:
      (obj.metadata as { mimetype?: string } | null)?.mimetype ?? 'application/octet-stream',
    size_bytes: (obj.metadata as { size?: number } | null)?.size ?? 0,
  })
  if (error) return { ok: false, error: content.docsErrorGeneric }
  revalidatePath('/case')
  return { ok: true }
}

export async function deleteUploadAction(uploadId: string): Promise<RecordUploadResult> {
  const content = await getStaticContent()
  const { supabase, caseRow } = await ownCase()
  if (!caseRow) return { ok: false, error: content.docsErrorGeneric }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: row } = await sb
    .from('document_upload')
    .select('id, storage_path')
    .eq('id', uploadId)
    .eq('case_id', caseRow.id)
    .single()
  if (!row) return { ok: false, error: content.docsErrorGeneric }
  // Storage object + metadata row together (self-service delete, decision 3).
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path])
  if (rmErr) return { ok: false, error: content.docsErrorGeneric }
  await sb.from('document_upload').delete().eq('id', row.id)
  revalidatePath('/case')
  return { ok: true }
}

export type DownloadUrlResult = { ok: true; url: string } | { ok: false; error: string }

export async function createDownloadUrlAction(uploadId: string): Promise<DownloadUrlResult> {
  const content = await getStaticContent()
  const { supabase, caseRow } = await ownCase()
  if (!caseRow) return { ok: false, error: content.docsErrorGeneric }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from('document_upload')
    .select('storage_path')
    .eq('id', uploadId)
    .eq('case_id', caseRow.id)
    .single()
  if (!row) return { ok: false, error: content.docsErrorGeneric }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60)
  if (error || !data) return { ok: false, error: content.docsErrorGeneric }
  return { ok: true, url: data.signedUrl }
}
