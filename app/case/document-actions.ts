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
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verifySession, getStaticContent } from '@/lib/dal'
import {
  allocateNumber,
  buildBase,
  buildObjectKey,
  extensionFor,
  folderFor,
  type SeqKey,
  type SeqStore,
} from '@/lib/storage-path'

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

/**
 * Counter backend for allocateNumber, on the service-role client.
 *
 * Server-only: `document_filename_seq` has RLS enabled with NO policies, so
 * the user-scoped client cannot touch it. This is reached only AFTER
 * ownCase() has verified the caller owns the case (same pattern as
 * status_event writes).
 */
function seqStore(): SeqStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const match = (k: SeqKey) =>
    admin
      .from('document_filename_seq')
      .select('last_n')
      .eq('case_id', k.caseId)
      .eq('folder', k.folder)
      .eq('base', k.base)
  return {
    async read(k) {
      const { data } = await match(k).maybeSingle()
      return typeof data?.last_n === 'number' ? data.last_n : null
    },
    async insertFirst(k) {
      const { error } = await admin
        .from('document_filename_seq')
        .insert({ case_id: k.caseId, folder: k.folder, base: k.base, last_n: 1 })
      return error ? 'conflict' : 'inserted'
    },
    async bump(k, from) {
      // Compare-and-set: the .eq('last_n', from) guard makes this atomic —
      // a concurrent writer that already bumped the row matches zero rows.
      const { data } = await admin
        .from('document_filename_seq')
        .update({ last_n: from + 1 })
        .eq('case_id', k.caseId)
        .eq('folder', k.folder)
        .eq('base', k.base)
        .eq('last_n', from)
        .select('last_n')
      return data && data.length === 1 ? data[0].last_n : null
    },
  }
}

/**
 * Mints a signed upload URL at the readable key
 * `{case_id}/{Folder}/{Base}{n}.{ext}` (Phase D).
 *
 * The document name, category and technical key are read from the catalog
 * SERVER-SIDE — the client only says which slot it is uploading to, never
 * what the file should be called.
 *
 * The number is allocated BEFORE the URL is minted, so two parallel uploads
 * can never be handed the same key (which would let the second PUT silently
 * overwrite the first). Accepted quirk: an abandoned upload burns its number,
 * leaving a gap (…1, …3) — gaps are harmless, reuse would not be.
 */
export async function createUploadUrlAction(input: {
  filename: string
  mimeType: string
  sizeBytes: number
  documentId: string
  subject: string
  instanceLabel?: string | null
}): Promise<CreateUploadUrlResult> {
  const content = await getStaticContent()
  const { supabase, caseRow } = await ownCase()
  if (!caseRow) return { ok: false, error: content.docsErrorGeneric }
  if (!ALLOWED_MIME.includes(input.mimeType) || !EXT_RE.test(input.filename))
    return { ok: false, error: content.docsErrorType }
  if (input.sizeBytes > MAX_BYTES) return { ok: false, error: content.docsErrorSize }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (supabase as any)
    .from('document_catalog')
    .select('name_de, technical_key, storage_category')
    .eq('id', input.documentId)
    .maybeSingle()
  if (!doc) return { ok: false, error: content.docsErrorGeneric }

  const folder = folderFor(doc.storage_category, input.subject)
  const base = buildBase({
    nameDe: doc.name_de,
    instanceLabel: input.instanceLabel ?? null,
    technicalKey: doc.technical_key,
    documentId: input.documentId,
  })

  let n: number
  try {
    n = await allocateNumber(seqStore(), { caseId: caseRow.id, folder, base })
  } catch {
    return { ok: false, error: content.docsErrorGeneric }
  }

  const path = buildObjectKey({
    caseId: caseRow.id,
    folder,
    base,
    n,
    ext: extensionFor(input.filename, input.mimeType),
  })
  // User-scoped client: the storage RLS insert policy authorizes the path
  // (it gates on the FIRST segment, so nesting needs no policy change).
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
  // Split on the LAST '/': Phase D keys are nested
  // ({case}/{Folder}/{Base}{n}.{ext}), and Storage lists ONE level at a time —
  // listing the case prefix for a nested name matches nothing, which would
  // fail every upload. Legacy flat keys ({case}/{uuid}.{ext}) still work here.
  const lastSlash = input.path.lastIndexOf('/')
  const dir = input.path.slice(0, lastSlash)
  const base = input.path.slice(lastSlash + 1)
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
  // NOTE: document_filename_seq is deliberately NOT decremented — numbers are
  // never reused, so deleting Heimvertrag2.pdf leaves the next upload at
  // Heimvertrag3.pdf rather than re-binding a name to a different document.
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
