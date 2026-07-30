/**
 * Storage path builder (feedback pass 3, Phase D) — pure, no I/O.
 *
 * New uploads land at
 *     {case_id}/{Folder}/{Base}{n}.{ext}
 * e.g. `…/Financial/Kontoauszuege_Girokonto1.pdf`, `…/Spouse/Personaldokument1.heic`
 * so a reviewer can read a case folder without opening every file.
 *
 * GRANDFATHERED: files uploaded before this change keep their flat
 * `{case_id}/{uuid}.{ext}` key forever. Nothing recomputes a path — every
 * consumer (download, delete, export, GDPR sweep) resolves the STORED
 * `document_upload.storage_path`. This module is only used when minting a
 * NEW key.
 *
 * FORWARD-ONLY: re-categorising a document later moves only future uploads;
 * stored files stay where they are and their counter keeps running in the
 * old folder's scope.
 */

export const STORAGE_FOLDERS = ['Personal', 'Housing', 'Financial', 'Insurance', 'Spouse'] as const
export type StorageFolder = (typeof STORAGE_FOLDERS)[number]

/** Caps agreed in the D-1 design: type base 60 chars, instance label 30. */
export const BASE_CAP = 60
export const LABEL_CAP = 30

const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
}

/** mime → extension, used only when the filename carries none (desktop HEIC). */
const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const EXT_RE = /\.(pdf|jpe?g|png|heic|heif)$/i

/**
 * German text → an ASCII, path-safe, human-readable segment.
 *
 * Umlauts are transliterated (ä→ae, ß→ss) **in filenames only** — this is
 * the deliberate inverse of house rule R3, which governs German copy in the
 * database. The catalog keeps "Kontoauszüge"; only the object key says
 * "Kontoauszuege".
 *
 * Everything that is not a letter or digit is treated as a word boundary and
 * dropped, with each word capitalised — one rule that removes slashes,
 * spaces, dots, quotes, control characters and emoji at once, rather than
 * blocklisting them. Returns '' when nothing survives (callers fall back).
 */
export function sanitizeSegment(input: string, cap: number): string {
  if (!input) return ''
  const transliterated = input.replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c])
  // NFD + strip combining marks handles the rest (é→e, ç→c).
  const ascii = transliterated.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const words = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (joined.length <= cap) return joined
  // Prefer cutting at an internal word boundary, but never lose most of the name.
  const cut = joined.slice(0, cap)
  const lastWordStart = cut.search(/[A-Z][^A-Z]*$/)
  return lastWordStart > cap * 0.6 ? cut.slice(0, lastWordStart) : cut
}

/**
 * Which folder a slot's file belongs in.
 *
 * `Spouse` is NOT a catalog property — the same Personaldokument is Personal
 * for the applicant and Spouse for the partner — so it is applied here, from
 * the slot's subject. `previous_home` (Mietvertrag, Mietkündigung) is
 * deliberately NOT overridden: it maps by catalog category (Housing).
 */
export function folderFor(storageCategory: string, subject: string): StorageFolder {
  if (subject === 'person_2') return 'Spouse'
  return (STORAGE_FOLDERS as readonly string[]).includes(storageCategory)
    ? (storageCategory as StorageFolder)
    : 'Personal' // unknown category → safest readable bucket (CHECK makes this unreachable)
}

/**
 * Filename base: the document type, plus the slot's instance label when it
 * has one, so per-account and per-pension slots stay distinguishable
 * (`Kontoauszuege_Girokonto`, `RentenPensionsbescheid_Rente1Altersrente`).
 * Falls back to technical_key, then the DOC id, if the German name sanitises
 * to nothing.
 */
export function buildBase(input: {
  nameDe: string
  instanceLabel?: string | null
  technicalKey?: string | null
  documentId: string
}): string {
  const typePart =
    sanitizeSegment(input.nameDe, BASE_CAP) ||
    sanitizeSegment(input.technicalKey ?? '', BASE_CAP) ||
    sanitizeSegment(input.documentId, BASE_CAP) ||
    'Dokument'
  const labelPart = input.instanceLabel ? sanitizeSegment(input.instanceLabel, LABEL_CAP) : ''
  return labelPart ? `${typePart}_${labelPart}` : typePart
}

/**
 * Extension for the object key: from the original filename, else derived from
 * the (already validated) MIME type, else omitted — never invented. The
 * upload action still rejects disallowed types before we get here; this is
 * the key-building fallback, and the real content type is set on the PUT.
 */
export function extensionFor(originalFilename: string, mimeType: string): string | null {
  const fromName = originalFilename.match(EXT_RE)?.[1]
  if (fromName) return fromName.toLowerCase()
  return MIME_EXT[mimeType] ?? null
}

/** Assembles the final object key. `{case}/{Folder}/{Base}{n}[.ext]` */
export function buildObjectKey(input: {
  caseId: string
  folder: StorageFolder
  base: string
  n: number
  ext: string | null
}): string {
  const suffix = input.ext ? `.${input.ext}` : ''
  return `${input.caseId}/${input.folder}/${input.base}${input.n}${suffix}`
}

// ── Filename counter ─────────────────────────────────────────────────────────

export type SeqKey = { caseId: string; folder: string; base: string }

/**
 * Storage-agnostic counter backend so the allocation logic stays unit-testable.
 * `bump` is a compare-and-set: it must only succeed when the stored value is
 * still `from`, returning null when another writer got there first.
 */
export type SeqStore = {
  read: (key: SeqKey) => Promise<number | null>
  insertFirst: (key: SeqKey) => Promise<'inserted' | 'conflict'>
  bump: (key: SeqKey, from: number) => Promise<number | null>
}

/**
 * Allocates the next file number for a (case, folder, base) scope.
 *
 * Numbers are **never reused**: the counter only ever increments and
 * `deleteUploadAction` deliberately never decrements it, so deleting
 * `Heimvertrag2.pdf` leaves the next upload at `Heimvertrag3.pdf`. That is
 * `max over everything ever created`, not `max over surviving rows`, which
 * is what stops a deleted file's name being re-bound to a different document.
 *
 * Concurrency: insert-if-absent (unique violation ⇒ someone raced) plus a
 * compare-and-set bump (0 rows updated ⇒ someone raced), retried. Two
 * parallel uploads to the same slot therefore get distinct numbers.
 *
 * NOTE (deviation from the D-1 sketch, deliberate): the design showed a
 * single `INSERT … ON CONFLICT DO UPDATE SET last_n = last_n + 1` statement.
 * PostgREST cannot express an expression-valued upsert, and the app has no
 * direct SQL connection, so the same guarantees are implemented with this
 * CAS+retry loop — the "unique constraint + retry" variant. Semantics are
 * identical: distinct numbers under concurrency, never reused.
 */
export async function allocateNumber(
  store: SeqStore,
  key: SeqKey,
  maxAttempts = 8
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.read(key)
    if (current === null) {
      if ((await store.insertFirst(key)) === 'inserted') return 1
      continue // lost the race — a row exists now, re-read and bump
    }
    const next = await store.bump(key, current)
    if (next !== null) return next
  }
  throw new Error(
    `allocateNumber: contention on ${key.folder}/${key.base} after ${maxAttempts} tries`
  )
}

// ── Recursive object listing ─────────────────────────────────────────────────

export type StorageEntry = { name: string; id: string | null }

/**
 * Every object under a prefix, at ANY depth.
 *
 * Supabase Storage lists one level at a time and reports a folder as an entry
 * with `id === null`. Since Phase D nests files under a category folder, a
 * single-level `list('{case_id}')` returns only folder names and would find
 * ZERO files — which is why the GDPR orphan sweep and the e2e cleanup both
 * use this instead. `maxDepth` guards against a pathological tree.
 */
export async function listAllObjectPaths(
  listFn: (prefix: string) => Promise<StorageEntry[]>,
  prefix: string,
  maxDepth = 4
): Promise<string[]> {
  if (maxDepth <= 0) return []
  const entries = await listFn(prefix)
  const out: string[] = []
  for (const entry of entries) {
    const full = `${prefix}/${entry.name}`
    if (entry.id === null) {
      out.push(...(await listAllObjectPaths(listFn, full, maxDepth - 1)))
    } else {
      out.push(full)
    }
  }
  return out
}
