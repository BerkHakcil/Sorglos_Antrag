/**
 * Shared e2e storage-cleanup helpers.
 *
 * Since Phase D, uploads are nested ({case}/{Category}/{Name}{n}.{ext}) and
 * Supabase Storage lists one level at a time — the previous
 * `list('<case_id>')` cleanup returned folder entries, not files, and would
 * have leaked every new-scheme object into the live bucket. All three e2e
 * suites go through `listAllObjectPaths` instead.
 */

import { listAllObjectPaths, type StorageEntry } from '../../lib/storage-path'

export { listAllObjectPaths }

/** Adapts a Supabase client to the injectable lister used by listAllObjectPaths. */
export function storageLister(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminDb: any,
  bucket = 'case-documents'
): (prefix: string) => Promise<StorageEntry[]> {
  return async (prefix: string) => {
    const { data, error } = await adminDb.storage.from(bucket).list(prefix, { limit: 1000 })
    if (error) throw new Error(`list ${prefix}: ${error.message}`)
    return (data ?? []) as StorageEntry[]
  }
}

/** Removes every object under a case prefix, at any depth. Returns counts. */
export async function purgeCasePrefix(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminDb: any,
  caseId: string
): Promise<{ removed: number; remaining: number }> {
  const lister = storageLister(adminDb)
  const paths = await listAllObjectPaths(lister, caseId)
  if (paths.length > 0) {
    await adminDb.storage.from('case-documents').remove(paths)
  }
  const remaining = await listAllObjectPaths(lister, caseId)
  return { removed: paths.length, remaining: remaining.length }
}
