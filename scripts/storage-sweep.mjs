/**
 * Recursive storage sweep for one case prefix — the GDPR runbook's
 * orphan-check step (docs/operations.md §4).
 *
 *   node scripts/storage-sweep.mjs <case_id>            # list every object
 *   node scripts/storage-sweep.mjs <case_id> --delete   # delete them all
 *
 * WHY THIS EXISTS: since Phase D, uploads are nested under a category folder
 * ({case}/{Financial}/Kontoauszuege_Girokonto1.pdf). Supabase Storage lists
 * ONE level at a time, so the old `list('<case_id>')` shows folder names and
 * ZERO files — an orphan sweep that stopped there would silently leave every
 * nested object behind. Legacy flat keys are found at the top level as before.
 *
 * Requires SUPABASE_SECRET_KEY — run only on trusted machines.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { listAllObjectPaths } from '../lib/storage-path.ts'

config({ path: '.env.local' })

const caseId = process.argv[2]
const doDelete = process.argv.includes('--delete')
if (!caseId) {
  console.error('Usage: node scripts/storage-sweep.mjs <case_id> [--delete]')
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const listFn = async (prefix) => {
  const { data, error } = await db.storage.from('case-documents').list(prefix, { limit: 1000 })
  if (error) throw new Error(`list ${prefix}: ${error.message}`)
  return data ?? []
}

const paths = await listAllObjectPaths(listFn, caseId)
console.log(`${paths.length} object(s) under ${caseId}/`)
for (const p of paths) console.log(`  ${p}`)

if (!doDelete) {
  console.log('\n(dry run — pass --delete to remove them)')
  process.exit(0)
}
if (paths.length === 0) process.exit(0)

const { error } = await db.storage.from('case-documents').remove(paths)
if (error) {
  console.error(`delete FAILED: ${error.message}`)
  process.exit(1)
}
const remaining = await listAllObjectPaths(listFn, caseId)
console.log(`deleted ${paths.length}, remaining ${remaining.length}`)
process.exit(remaining.length === 0 ? 0 : 1)
