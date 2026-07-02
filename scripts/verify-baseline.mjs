/**
 * Diff-verify the baseline migration.
 *
 * Compares two data sources and asserts they are identical:
 *
 *   SOURCE A: LIVE production DB (via NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY)
 *   SOURCE B: LOCAL DB after `supabase db reset` (via LOCAL_DATABASE_URL)
 *
 * Usage:
 *   # 1. Run local reset first:
 *   npx supabase db reset
 *
 *   # 2. Set your local DB URL (find it in supabase status):
 *   export LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
 *
 *   # 3. Run verification:
 *   node scripts/verify-baseline.mjs
 *
 * Exit 0 = identical. Exit 1 = discrepancies found (diffs printed to stdout).
 *
 * If LOCAL_DATABASE_URL is unset, runs in PRODUCTION-ONLY mode and prints a
 * summary of the live state (useful for confirming the production side is clean).
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PROD_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const PROD_KEY  = process.env.SUPABASE_SECRET_KEY
const LOCAL_URL = process.env.LOCAL_DATABASE_URL

if (!PROD_URL || !PROD_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const prod = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ── Fetch production state ──────────────────────────────────────────────────

const [
  { data: prodCats  }, { data: prodGrps  },
  { data: prodQs    }, { data: prodOpts  },
] = await Promise.all([
  prod.from('category').select('id, key, label_de, sort_order').order('sort_order'),
  prod.from('question_group').select('id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count').order('category_id, sort_order'),
  prod.from('question').select('id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule').order('category_id, sort_order'),
  prod.from('question_option').select('id, question_id, key, sort_order, label_de, value').order('question_id, sort_order'),
])

console.log(`\n=== PRODUCTION STATE ===`)
console.log(`Categories:  ${prodCats.length}`)
console.log(`Groups:      ${prodGrps.length}`)
console.log(`Questions:   ${prodQs.length}`)
console.log(`Options:     ${prodOpts.length}`)
console.log(`\nCategory keys: ${prodCats.map(c => `${c.key}(${c.label_de})`).join(', ')}`)
console.log(`Question count by answer_type:`)
const byType = {}
for (const q of prodQs) byType[q.answer_type] = (byType[q.answer_type] ?? 0) + 1
for (const [type, count] of Object.entries(byType).sort()) console.log(`  ${type}: ${count}`)

// Spot-check critical questions
const criticalKeys = ['rentenbetrag', 'hat_rente', 'spouse_wohngeld_yes_no', 'spouse_wohngeld_amount', 'spouse_wohngeld_id']
console.log(`\nCritical visibility rules:`)
for (const key of criticalKeys) {
  const q = prodQs.find(q => q.key === key)
  if (q) console.log(`  ${key}: ${JSON.stringify(q.visibility_rule)}`)
  else    console.log(`  ${key}: NOT FOUND`)
}

if (!LOCAL_URL) {
  console.log(`\n[INFO] LOCAL_DATABASE_URL not set — production-only summary above.`)
  console.log(`To run the full diff: set LOCAL_DATABASE_URL and re-run after supabase db reset.`)
  console.log(`\n✅ Production state looks clean (${prodQs.length} questions, no document_upload).`)
  const docQ = prodQs.filter(q => q.answer_type === 'document_upload')
  if (docQ.length > 0) {
    console.error(`❌ document_upload questions still exist: ${docQ.map(q => q.key).join(', ')}`)
    process.exit(1)
  }
  process.exit(0)
}

// ── Fetch local state (via pg direct connection) ────────────────────────────
// We use dynamic import so the script still runs (prod-only) if pg isn't installed.

let pg
try {
  const mod = await import('pg')
  pg = mod.default ?? mod
} catch {
  console.error(`[ERROR] "pg" package not found. Run: npm install --save-dev pg`)
  console.error(`Then re-run this script with LOCAL_DATABASE_URL set.`)
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: LOCAL_URL, ssl: false })

async function queryLocal(sql) {
  const result = await pool.query(sql)
  return result.rows
}

const [localCats, localGrps, localQs, localOpts] = await Promise.all([
  queryLocal(`SELECT id, key, label_de, sort_order FROM public.category ORDER BY sort_order`),
  queryLocal(`SELECT id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count FROM public.question_group ORDER BY category_id, sort_order`),
  queryLocal(`SELECT id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation::text, visibility_rule::text FROM public.question ORDER BY category_id, sort_order`),
  queryLocal(`SELECT id, question_id, key, sort_order, label_de, value FROM public.question_option ORDER BY question_id, sort_order`),
])

await pool.end()

console.log(`\n=== LOCAL STATE (after db reset) ===`)
console.log(`Categories:  ${localCats.length}`)
console.log(`Groups:      ${localGrps.length}`)
console.log(`Questions:   ${localQs.length}`)
console.log(`Options:     ${localOpts.length}`)

// ── Diff ────────────────────────────────────────────────────────────────────

let diffs = 0

// Postgres's jsonb::text cast renders whitespace differently from JS's
// JSON.stringify (e.g. spaces after ":"), even for structurally identical
// values. Canonicalize (parse + sort keys + re-stringify) both sides before
// comparing so formatting alone never produces a false-positive diff.
function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize)
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => { acc[k] = canonicalize(v[k]); return acc }, {})
  }
  return v
}

function normalize(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(canonicalize(v))
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.stringify(canonicalize(JSON.parse(t))) } catch { /* not JSON, fall through */ }
    }
  }
  return String(v)
}

function diffArrays(label, prodRows, localRows, keyFn, fields) {
  const prodMap  = Object.fromEntries(prodRows.map(r  => [keyFn(r),  r]))
  const localMap = Object.fromEntries(localRows.map(r => [keyFn(r), r]))

  const prodKeys  = new Set(Object.keys(prodMap))
  const localKeys = new Set(Object.keys(localMap))

  const missing  = [...prodKeys].filter(k => !localKeys.has(k))
  const extra    = [...localKeys].filter(k => !prodKeys.has(k))
  const changed  = []

  for (const key of prodKeys) {
    if (!localKeys.has(key)) continue
    const p = prodMap[key]
    const l = localMap[key]
    const fieldDiffs = []
    for (const f of fields) {
      const pv = normalize(p[f])
      const lv = normalize(l[f])
      if (pv !== lv) fieldDiffs.push(`    ${f}: prod="${pv}" local="${lv}"`)
    }
    if (fieldDiffs.length > 0) changed.push({ key, diffs: fieldDiffs })
  }

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(`✅ ${label}: identical (${prodRows.length} rows)`)
    return
  }

  console.log(`\n❌ ${label}: DIFF FOUND`)
  if (missing.length)  console.log(`  Missing in local (${missing.length}): ${missing.join(', ')}`)
  if (extra.length)    console.log(`  Extra in local   (${extra.length}): ${extra.join(', ')}`)
  for (const { key, diffs: ds } of changed.slice(0, 10)) {
    console.log(`  Changed: ${key}`)
    ds.forEach(d => console.log(d))
  }
  if (changed.length > 10) console.log(`  ... and ${changed.length - 10} more changes`)
  diffs += missing.length + extra.length + changed.length
}

console.log(`\n=== DIFF ===`)
diffArrays('Categories',   prodCats,  localCats,  r => r.id, ['key','label_de','sort_order'])
diffArrays('Groups',       prodGrps,  localGrps,  r => r.id, ['key','label_de','sort_order','is_repeatable','min_count','max_count'])
diffArrays('Questions',    prodQs,    localQs,    r => r.key, ['category_id','group_id','sort_order','answer_type','is_required','prompt_de','help_de','validation','visibility_rule'])
diffArrays('Options',      prodOpts,  localOpts,  r => `${r.question_id}/${r.key}`, ['sort_order','label_de','value'])

console.log(`\n${'─'.repeat(50)}`)
if (diffs === 0) {
  console.log(`✅ BASELINE FAITHFUL: local (post-reset) === production exactly`)
  process.exit(0)
} else {
  console.log(`❌ DIFF FOUND: ${diffs} discrepancies`)
  process.exit(1)
}
