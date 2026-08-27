/**
 * Fallback-docs fix (Gate 1, Line A) — live verification. GET-ONLY.
 *
 *   node scripts/verify-fallback-doclist.mjs
 *
 * Issues REST selects exclusively — writes to NO database and NO repo path.
 * (A "verify by creating a probe case" shortcut would violate the fix's
 * no-prod-writes anti-goal; this script has no insert/update/delete/rpc.)
 *
 * Two modes, auto-detected from app_config:
 *   PRE  — 'fallback_excluded_rule_ids' absent (migration 20260826000001 not
 *          pushed yet): verifies prod still matches the Phase-1 baseline
 *          (docs/feedback/fallback_docs_phase1.md §4, column "now") and that
 *          the deployed code fail-opens to the pre-fix list.
 *   POST — the row exists: verifies the approved Line-A impact numbers per
 *          case, the exact config content, that every excluded id is an
 *          active rule of the default office, that Pankow/Essen own-office
 *          resolution is provably unaffected by the exclusion row, and that
 *          uploads on dropped rules classify not_required.
 *
 * The per-case slot/missing computation mirrors the app exactly — it imports
 * the SAME modules the app runs (rules-source ladder, document-rules
 * evaluator, group-instances derivation) and rebuilds getCaseAnswers'
 * active-question filter. Baseline drift (a case answered more questions
 * since 2026-08-25, or a new case appeared) downgrades that case to
 * structural asserts with a loud warning instead of failing on a stale
 * constant.
 *
 * Requires SUPABASE_SECRET_KEY in .env.local (parsed directly — no dotenv
 * dependency). Run on trusted machines only.
 */

import { readFileSync } from 'fs'
import { evaluateDocumentRules, countMissingSlots, classifyUploads } from '../lib/document-rules.ts'
import { deriveGroupData } from '../lib/group-instances.ts'
import {
  resolveEffectiveRules,
  parseDefaultOfficeId,
  parseExcludedRuleIds,
  DEFAULT_OFFICE_CONFIG_KEY,
  FALLBACK_EXCLUSIONS_CONFIG_KEY,
} from '../lib/rules-source.ts'

const LINE_A = ['PAN-016', 'PAN-017', 'PAN-018']

/** Phase-1 §4 baseline (scan of 2026-08-25). answer_rows anchors drift
 *  detection; hidden = RULE IDS of the uploads expected not_required under
 *  Line A — ONE ENTRY PER UPLOAD (duplicates meaningful), compared against
 *  each not_required upload's `rule_id`. Deliberately NOT original_filename
 *  (the pre-2026-08-27 mechanism): filenames are user-supplied and can carry
 *  real customers' names — the PII sweep of 2026-08-27 moved this assert to
 *  the rule id, which also pins WHICH dropped rule each hidden upload
 *  belongs to. Trade-off, on the record: a same-rule file swap (one file
 *  replaced by a different file on the same rule) is no longer detectable —
 *  counts and classification, this script's actual job, are unaffected. */
const BASELINE = {
  'c8542a35-b5b1-4748-b054-a7a1914b2d62': {
    answers: 12,
    now: [13, 13],
    lineA: [10, 10],
    hidden: [],
  },
  '52e364f1-e27e-4e79-b455-55d658e1be95': {
    answers: 78,
    now: [17, 0],
    lineA: [14, 0],
    hidden: ['PAN-016', 'PAN-017', 'PAN-018'],
  },
  '3b201f7f-d3f2-4e8c-b8e5-cd95049f29cf': { answers: 47, now: [12, 12], lineA: [9, 9], hidden: [] },
  'ecdf545d-5ce2-4b49-8b7b-43feaa8244dc': {
    answers: 76,
    now: [13, 7],
    lineA: [13, 7],
    hidden: [],
    own: true,
  },
  'e29041c5-a530-4758-abea-7edf16f2ae67': { answers: 13, now: [12, 12], lineA: [9, 9], hidden: [] },
  '656568d4-818e-454e-be38-9f1ffb668fc4': { answers: 21, now: [12, 12], lineA: [9, 9], hidden: [] },
  '78293a6c-1d62-49de-9acb-8a85ce2f3b3e': {
    answers: 79,
    now: [21, 7],
    lineA: [18, 5],
    hidden: ['PAN-017'],
  },
  '480c2e44-7144-4655-876a-02b788d3b308': { answers: 6, now: [11, 10], lineA: [8, 7], hidden: [] },
}

// ── env + GET helper ──────────────────────────────────────────────────────────

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf-8').split(
  /\r?\n/
)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = env.SUPABASE_SECRET_KEY
if (!URL_BASE || !SECRET) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}
const HEADERS = { apikey: SECRET, Authorization: `Bearer ${SECRET}` }
async function get(path) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: HEADERS })
    if (res.ok) return res.json()
    const body = await res.text()
    // PGRST303 "JWT issued at future" is transient server clock skew — retry.
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 400 * attempt))
      continue
    }
    throw new Error(`GET ${path} → ${res.status} ${body}`)
  }
}

// ── assertion plumbing ────────────────────────────────────────────────────────

let failures = 0
let warnings = 0
function check(ok, label, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures++
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
function warn(label) {
  warnings++
  console.warn(`  WARN  ${label}`)
}

// ── global config + rules ─────────────────────────────────────────────────────

const [cases, appConfig, allRules, catalog, statics] = await Promise.all([
  get('cases?select=*&order=created_at.asc'),
  get('app_config?select=*'),
  get('office_document_rule?select=*&order=id.asc'),
  get('document_catalog?select=*&order=id.asc'),
  get('static_content?select=key,value_de'),
])

const defaultOfficeId = parseDefaultOfficeId(
  appConfig.find((r) => r.key === DEFAULT_OFFICE_CONFIG_KEY)?.value
)
const exclusionRow = appConfig.find((r) => r.key === FALLBACK_EXCLUSIONS_CONFIG_KEY)
const excludedRuleIds = parseExcludedRuleIds(exclusionRow?.value)
const POST = exclusionRow !== undefined

const catalogById = Object.fromEntries(catalog.filter((d) => d.active).map((d) => [d.id, d]))
const activeRulesByOffice = {}
for (const r of allRules) {
  if (r.active) (activeRulesByOffice[r.social_office_id] ??= []).push(r)
}

console.log(
  `\n=== fallback-doclist verification — mode: ${POST ? 'POST-migration' : 'PRE-migration'} ===\n`
)

// ── 1. Config content ─────────────────────────────────────────────────────────

console.log('[1] app_config')
check(defaultOfficeId !== null, 'default_document_office_id present', 'missing — ladder dead')
if (POST) {
  check(
    JSON.stringify(exclusionRow.value) === JSON.stringify(LINE_A),
    `fallback_excluded_rule_ids is exactly the Line-A trio`,
    `got ${JSON.stringify(exclusionRow.value)}`
  )
  const defaultActive = new Set((activeRulesByOffice[defaultOfficeId] ?? []).map((r) => r.id))
  for (const id of LINE_A) {
    check(defaultActive.has(id), `${id} is an active rule of the default office`)
  }
} else {
  warn(
    'exclusion row absent — PRE mode: verifying the pre-fix baseline; push migration 20260826000001, then re-run'
  )
}
check(
  statics.some((s) => s.key === 'docs.fallback_notice' && s.value_de.length > 0),
  'docs.fallback_notice static row untouched (stays in DB, unread)'
)

// ── 2. Own-office resolution provably unaffected by the exclusion row ─────────

console.log('[2] own-office byte-identity (Pankow + Essen)')
for (const [officeId, rules] of Object.entries(activeRulesByOffice)) {
  const withExcl = resolveEffectiveRules({
    socialOfficeId: officeId,
    ownRules: rules,
    defaultOfficeId,
    defaultRules: activeRulesByOffice[defaultOfficeId] ?? [],
    excludedRuleIds,
  })
  const without = resolveEffectiveRules({
    socialOfficeId: officeId,
    ownRules: rules,
    defaultOfficeId,
    defaultRules: activeRulesByOffice[defaultOfficeId] ?? [],
    excludedRuleIds: [],
  })
  check(
    withExcl.rulesSource === 'own' &&
      JSON.stringify(withExcl.rules) === JSON.stringify(without.rules) &&
      withExcl.rules.length === rules.length,
    `office ${officeId}: own resolution byte-identical with and without exclusions (${rules.length} rules)`
  )
}

// ── 3. Per-case impact numbers (the app's own derivation) ─────────────────────

const qnStructCache = {}
async function qnStruct(qnId) {
  if (qnStructCache[qnId]) return qnStructCache[qnId]
  const cats = await get(`category?questionnaire_id=eq.${qnId}&select=id&order=sort_order.asc`)
  const catIds = cats.map((c) => c.id).join(',')
  const [groups, questions] = await Promise.all([
    get(`question_group?category_id=in.(${catIds})&select=id,key,is_repeatable,count_source_key`),
    get(`question?category_id=in.(${catIds})&select=id,key,group_id,active&order=sort_order.asc`),
  ])
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]))
  const pseudo = {
    id: qnId,
    name: '',
    categories: [
      {
        id: 'verify',
        key: 'verify',
        sort_order: 0,
        label_de: '',
        questions: questions.map((q) => {
          const g = q.group_id ? groupById[q.group_id] : null
          return {
            ...q,
            group_key: g?.key ?? null,
            group_is_repeatable: g?.is_repeatable ?? null,
            group_count_source_key: g?.count_source_key ?? null,
          }
        }),
      },
    ],
  }
  const activeKeyById = {}
  for (const q of questions) if (q.active) activeKeyById[q.id] = q.key
  qnStructCache[qnId] = { pseudo, activeKeyById }
  return qnStructCache[qnId]
}

console.log('[3] per-case impact numbers')
const expectedCol = POST ? 'lineA' : 'now'
for (const c of cases) {
  const [answerRows, uploads] = await Promise.all([
    get(`answer?case_id=eq.${c.id}&select=question_id,group_instance,value&order=created_at.asc`),
    get(`document_upload?case_id=eq.${c.id}&select=*&order=created_at.asc`),
  ])

  let slots = []
  let rulesSource = 'none'
  if (c.questionnaire_id) {
    const { pseudo, activeKeyById } = await qnStruct(c.questionnaire_id)
    const answersMap = {}
    const answersRaw = []
    for (const row of answerRows) {
      const key = activeKeyById[row.question_id]
      if (!key) continue
      answersRaw.push({
        question_id: row.question_id,
        group_instance: row.group_instance,
        value: row.value,
      })
      if (row.group_instance === 'default') answersMap[key] = row.value
    }
    const { groupInstances, groupAnswers } = deriveGroupData(pseudo, answersRaw, 'render')
    const resolved = resolveEffectiveRules({
      socialOfficeId: c.social_office_id,
      ownRules: c.social_office_id ? (activeRulesByOffice[c.social_office_id] ?? []) : [],
      defaultOfficeId,
      defaultRules: activeRulesByOffice[defaultOfficeId] ?? [],
      excludedRuleIds,
    })
    rulesSource = resolved.rulesSource
    if (resolved.rules.length > 0) {
      slots = evaluateDocumentRules(resolved.rules, catalogById, {
        answers: answersMap,
        groupInstances,
        groupAnswers,
      })
    }
  }

  const missing = countMissingSlots(slots, uploads)
  const { notRequired } = classifyUploads(slots, uploads)
  const short = c.id.slice(0, 8)
  const base = BASELINE[c.id]

  // Structural invariants, every case, both modes.
  if (POST && rulesSource === 'fallback') {
    check(
      !slots.some((s) => LINE_A.includes(s.ruleId)),
      `${short}: no Line-A slot served on the fallback path`
    )
  }
  if (rulesSource === 'own' && c.social_office_id === defaultOfficeId) {
    warn(
      `${short}: a case is now routed to the DEFAULT office itself — the own-office guard branch has its first live representative; re-check it explicitly`
    )
  }

  if (!base) {
    warn(
      `${short}: NEW case (not in the 2026-08-25 baseline) — structural asserts only: slots=${slots.length} missing=${missing} source=${rulesSource}`
    )
    continue
  }
  if (base.answers !== answerRows.length) {
    warn(
      `${short}: baseline drifted (${base.answers} → ${answerRows.length} answer rows) — expected numbers recomputed live: slots=${slots.length} missing=${missing} (baseline ${expectedCol} was ${BASELINE[c.id][expectedCol].join('/')})`
    )
  } else {
    const [expSlots, expMissing] = base[expectedCol]
    check(
      slots.length === expSlots && missing === expMissing,
      `${short}: slots/missing = ${expSlots}/${expMissing}${base.own ? ' (own-office Essen — must be untouched)' : ''}`,
      `got ${slots.length}/${missing}`
    )
  }
  const expHidden = POST ? base.hidden : []
  // Rule ids, not filenames — see the BASELINE comment (PII sweep 2026-08-27).
  const gotHidden = notRequired.map((u) => u.rule_id).sort()
  check(
    JSON.stringify(gotHidden) === JSON.stringify([...expHidden].sort()),
    `${short}: not_required uploads on rules [${expHidden.join(', ') || 'none'}]`,
    `got [${gotHidden.join(', ')}]`
  )
}

// ── verdict ───────────────────────────────────────────────────────────────────

console.log(
  `\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${warnings} warning(s), mode ${POST ? 'POST' : 'PRE'}) ===`
)
process.exit(failures === 0 ? 0 : 1)
