/**
 * Dumps the full Berlin questionnaire question list from production DB.
 * Run: node scripts/dump-questions.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://srtgqgueigyucanfzodb.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydGdxZ3VlaWd5dWNhbmZ6b2RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MTg5NSwiZXhwIjoyMDk2NDI3ODk1fQ.XLw1_2NaUFhuRSjA92SQufYJ2TY3NCrLLGbp78ONy0Q'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Get categories first
const { data: cats } = await admin
  .from('category')
  .select('id, label_de, sort_order')
  .order('sort_order')

console.log('\n=== CATEGORIES ===')
for (const c of cats) {
  console.log(`  [${c.sort_order}] ${c.id} → "${c.label_de}"`)
}

// First check columns
const { data: colCheck, error: colErr } = await admin
  .from('question')
  .select('*')
  .limit(1)

if (colErr) {
  console.error('Schema check error:', colErr)
  process.exit(1)
}

if (colCheck?.length > 0) {
  console.log('\n=== QUESTION TABLE COLUMNS ===')
  console.log(Object.keys(colCheck[0]).join(', '))
}

// Get all questions with their category info
const { data: questions, error } = await admin
  .from('question')
  .select(`
    id, key, prompt_de, help_de, answer_type, sort_order,
    is_required, visibility_rule,
    group_id,
    category_id,
    category:category_id(label_de, sort_order),
    group:group_id(key, label_de, is_repeatable, max_count)
  `)
  .order('sort_order')

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log(`\n=== QUESTIONS (${questions.length} total) ===`)
let lastCat = null
for (const q of questions) {
  const catLabel = q.category?.label_de ?? q.category_id
  if (catLabel !== lastCat) {
    console.log(`\n--- ${catLabel} ---`)
    lastCat = catLabel
  }
  const vis = q.visibility_rule ? ` [vis: ${JSON.stringify(q.visibility_rule)}]` : ''
  const req = q.is_required ? ' [REQ]' : ' [opt]'
  const grpInfo = q.group ? `${q.group.key}${q.group.is_repeatable ? '(rep)' : ''}` : null
  const grp = grpInfo ? ` [grp: ${grpInfo}]` : ''
  console.log(`  [${String(q.sort_order).padStart(3)}] ${q.key} | ${q.answer_type}${req}${grp}${vis}`)
  console.log(`         "${q.prompt_de}"`)

}

// Also get options for single_select questions
const { data: options } = await admin
  .from('question_option')
  .select('question_id, value, label_de, sort_order')
  .order('sort_order')

// Group options by question_id
const optsByQ = {}
for (const o of options) {
  if (!optsByQ[o.question_id]) optsByQ[o.question_id] = []
  optsByQ[o.question_id].push(o)
}

console.log('\n=== SINGLE_SELECT OPTIONS ===')
for (const q of (questions || []).filter(q => q.answer_type === 'single_select')) {
  const opts = optsByQ[q.id] ?? []
  if (opts.length > 0) {
    console.log(`  ${q.key}: ${opts.map(o => `"${o.value}"="${o.label_de}"`).join(', ')}`)
  }
}
