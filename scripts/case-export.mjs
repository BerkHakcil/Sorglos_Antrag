/**
 * M7 operations bridge — export one case for manual processing.
 *
 *   npm run case:export -- <case_id>
 *
 * Produces exports/<case_id>-<yyyymmdd>/ with:
 *   answers.md    all answered questions as German Q&A in questionnaire order,
 *                 repeatable-group instances labeled ("<Gruppe> 1", "<Gruppe> 2", …)
 *   documents.md  the evaluated document checklist with per-slot upload status
 *                 (same evaluator the app uses: lib/document-rules.ts)
 *   files/        every uploaded file, downloaded via service role,
 *                 named <rule>_<instance>_<original name>
 *
 * This is how a completed case reaches the human who fills the official PDF.
 * Requires SUPABASE_SECRET_KEY in .env.local — run it only on trusted machines;
 * the exports/ folder contains personal data and is gitignored. Delete exports
 * when the case is processed.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
import { evaluateDocumentRules, countMissingSlots, periodSuffix } from '../lib/document-rules.ts'

config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
if (!URL || !SECRET) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}
const caseId = process.argv[2]
if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
  console.error('Usage: npm run case:export -- <case_id (uuid)>')
  process.exit(1)
}

const db = createClient(URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } })

// ── Load everything ───────────────────────────────────────────────────────────

const { data: caseRow, error: caseErr } = await db
  .from('cases')
  .select('*')
  .eq('id', caseId)
  .single()
if (caseErr || !caseRow) {
  console.error(`Case not found: ${caseId} ${caseErr?.message ?? ''}`)
  process.exit(1)
}

const [{ data: profile }, { data: authUser }, { data: careHome }, { data: office }, { data: qn }] =
  await Promise.all([
    db.from('profiles').select('first_name, last_name, phone').eq('id', caseRow.user_id).single(),
    db.auth.admin.getUserById(caseRow.user_id),
    caseRow.care_home_id
      ? db.from('care_home').select('name').eq('id', caseRow.care_home_id).single()
      : { data: null },
    caseRow.social_office_id
      ? db.from('social_office').select('name').eq('id', caseRow.social_office_id).single()
      : { data: null },
    db.from('questionnaire').select('name').eq('id', caseRow.questionnaire_id).single(),
  ])

const { data: cats } = await db
  .from('category')
  .select('id, key, label_de, sort_order')
  .eq('questionnaire_id', caseRow.questionnaire_id)
  .order('sort_order')
const catIds = cats.map((c) => c.id)
const [{ data: groups }, { data: questions }, { data: answers }] = await Promise.all([
  db
    .from('question_group')
    .select('id, category_id, key, label_de, sort_order, is_repeatable')
    .in('category_id', catIds),
  db
    .from('question')
    .select('id, category_id, group_id, key, sort_order, prompt_de, answer_type')
    .in('category_id', catIds)
    .order('sort_order'),
  db
    .from('answer')
    .select('question_id, group_instance, value, created_at')
    .eq('case_id', caseId)
    .order('created_at'),
])

const qById = Object.fromEntries(questions.map((q) => [q.id, q]))
const groupById = Object.fromEntries((groups ?? []).map((g) => [g.id, g]))

// answersMap (flat) + group instances/answers — mirrors deriveGroupData in
// app/case/page.tsx (instance order = first appearance in created_at order).
const answersMap = {}
const groupInstances = {}
const groupAnswers = {}
for (const a of answers) {
  const q = qById[a.question_id]
  if (!q) continue
  const g = q.group_id ? groupById[q.group_id] : null
  if (g?.is_repeatable && a.group_instance !== 'default') {
    const list = (groupInstances[g.key] ??= [])
    if (!list.includes(a.group_instance)) list.push(a.group_instance)
    ;(groupAnswers[a.group_instance] ??= {})[q.key] = a.value
  } else {
    answersMap[q.key] = a.value
  }
}

function fmtValue(v) {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ── answers.md ────────────────────────────────────────────────────────────────

const email = authUser?.user?.email ?? '(unknown)'
const lines = []
lines.push(`# Case export ${caseId}`)
lines.push('')
lines.push(`| | |`)
lines.push(`|---|---|`)
lines.push(`| Antragsteller (Konto) | ${profile?.first_name ?? ''} ${profile?.last_name ?? ''} |`)
lines.push(`| E-Mail | ${email} |`)
lines.push(`| Telefon | ${profile?.phone ?? ''} |`)
lines.push(`| Pflegeheim | ${careHome?.name ?? '—'} |`)
lines.push(
  `| PLZ vor Einzug | ${caseRow.plz_before_move ?? '—'} (${caseRow.plz_resolution_status ?? ''}) |`
)
lines.push(`| Sozialamt | ${office?.name ?? '—'} |`)
lines.push(`| Fragebogen | ${qn?.name ?? caseRow.questionnaire_id} |`)
lines.push(`| Status | ${caseRow.status} |`)
lines.push(`| Erstellt / Aktualisiert | ${caseRow.created_at} / ${caseRow.updated_at} |`)
lines.push('')
lines.push(`_Only answered questions are listed (${answers.length} answer rows)._`)

for (const cat of cats) {
  const catQs = questions.filter((q) => q.category_id === cat.id)
  if (!catQs.length) continue
  const renderedGroups = new Set()
  let catHeaderDone = false
  const header = () => {
    if (!catHeaderDone) {
      lines.push('', `## ${cat.label_de}`, '')
      catHeaderDone = true
    }
  }
  for (const q of catQs) {
    const g = q.group_id ? groupById[q.group_id] : null
    if (g?.is_repeatable) {
      if (renderedGroups.has(g.id)) continue
      renderedGroups.add(g.id)
      const instances = groupInstances[g.key] ?? []
      const members = catQs.filter((m) => m.group_id === g.id)
      instances.forEach((inst, idx) => {
        const ia = groupAnswers[inst] ?? {}
        const answered = members.filter((m) => ia[m.key] !== undefined)
        if (!answered.length) return
        header()
        lines.push(`### ${g.label_de} ${idx + 1}`, '')
        for (const m of answered) lines.push(`**${m.prompt_de}**`, `${fmtValue(ia[m.key])}`, '')
      })
    } else if (answersMap[q.key] !== undefined) {
      header()
      lines.push(`**${q.prompt_de}**`, `${fmtValue(answersMap[q.key])}`, '')
    }
  }
}

// ── documents.md + files/ ─────────────────────────────────────────────────────

const docLines = [`# Document checklist — case ${caseId}`, '']
let slots = []
let uploads = []
if (caseRow.social_office_id) {
  const [{ data: rules }, { data: catalog }, { data: uploadRows }, { data: suffixRow }] =
    await Promise.all([
      // active = true only — retired rules (pass 3 item 5) emit no slot, matching
      // the app. files/ below still exports EVERY upload row, so a file uploaded
      // before a rule was retired is never lost to the team.
      db
        .from('office_document_rule')
        .select('*')
        .eq('social_office_id', caseRow.social_office_id)
        .eq('active', true),
      db.from('document_catalog').select('*'),
      db.from('document_upload').select('*').eq('case_id', caseId).order('created_at'),
      // D10 (pass 4): the same suffix template the checklist renders, so the
      // team-facing documents.md shows the identical display name.
      db.from('static_content').select('value_de').eq('key', 'docs.period_suffix').maybeSingle(),
    ])
  const suffixTemplate = suffixRow?.value_de ?? ''
  uploads = uploadRows ?? []
  if (rules?.length) {
    const catalogById = Object.fromEntries(catalog.map((d) => [d.id, d]))
    slots = evaluateDocumentRules(rules, catalogById, {
      answers: answersMap,
      groupInstances,
      groupAnswers,
    })
    const missing = countMissingSlots(slots, uploads)
    docLines.push(
      `Slots: ${slots.length} — with upload: ${slots.length - missing} — missing: **${missing}**`,
      ''
    )
    docLines.push(`| Person | Document | Slot | Files |`, `|---|---|---|---|`)
    for (const s of slots) {
      const files = uploads.filter(
        (u) => u.rule_id === s.ruleId && u.instance_key === s.instanceKey
      )
      // D10: period suffix on the displayed document name (checklist parity).
      const sfx = periodSuffix(s.periodMonths, suffixTemplate)
      docLines.push(
        `| ${s.subject} | ${s.nameDe}${sfx ? ` ${sfx}` : ''} | ${s.instanceLabel ?? '—'} | ${files.length ? files.map((f) => f.original_filename).join(', ') : '**FEHLT**'} |`
      )
    }
  } else {
    docLines.push('_The resolved office has no document rules (no document area for this case)._')
  }
} else {
  docLines.push('_No resolved social office — no document checklist._')
}

/**
 * Export filename for one upload.
 *
 * Phase D keys are already readable ({case}/{Folder}/{Base}{n}.{ext}), so we
 * reuse the stored basename and prefix the CATEGORY — not the rule id, which
 * would be double prefixing. The folder prefix is required, not decoration:
 * `files/` is flat, and Personal/Personaldokument1.pdf would otherwise collide
 * with Spouse/Personaldokument1.pdf. Legacy flat keys are UUIDs, so those keep
 * the original rule_instance_filename naming — the only readable option.
 */
function exportFileName(u) {
  const segments = u.storage_path.split('/')
  const raw =
    segments.length >= 3
      ? `${segments[segments.length - 2]}_${segments[segments.length - 1]}`
      : `${u.rule_id}_${u.instance_key}_${u.original_filename}`
  return raw.replace(/[^\w.\-äöüÄÖÜß ]/g, '_')
}

// ── Write output ──────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const outDir = join('exports', `${caseId}-${stamp}`)
mkdirSync(join(outDir, 'files'), { recursive: true })
writeFileSync(join(outDir, 'answers.md'), lines.join('\n') + '\n', 'utf-8')
writeFileSync(join(outDir, 'documents.md'), docLines.join('\n') + '\n', 'utf-8')

let downloaded = 0
for (const u of uploads) {
  const { data, error } = await db.storage.from('case-documents').download(u.storage_path)
  if (error || !data) {
    console.error(`  download FAILED: ${u.storage_path} — ${error?.message}`)
    continue
  }
  writeFileSync(join(outDir, 'files', exportFileName(u)), Buffer.from(await data.arrayBuffer()))
  downloaded++
}

console.log(`Exported case ${caseId}`)
console.log(`  → ${outDir}`)
console.log(`  answers.md   (${answers.length} answer rows)`)
console.log(`  documents.md (${slots.length} slots)`)
console.log(`  files/       (${downloaded}/${uploads.length} files downloaded)`)
if (downloaded !== uploads.length) process.exit(1)
