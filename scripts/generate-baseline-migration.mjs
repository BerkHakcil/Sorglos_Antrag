/**
 * Generates supabase/migrations/20260702000001_baseline_questionnaire_state.sql
 *
 * Queries the LIVE production DB and emits an idempotent migration that, when
 * applied on top of all prior migrations, reproduces the exact live questionnaire
 * state (categories, question_groups, questions, and question_options).
 *
 * This captures every dashboard edit that bypassed migrations since the seed.
 *
 * Decision on 20260622000001 (remove_document_upload_questions.sql) debt:
 *   That migration was never applied to production, so personalausweis_upload
 *   still exists there. We FOLD the removal INTO this baseline by:
 *     1. Excluding document_upload questions from the INSERT block below.
 *     2. Emitting an explicit DELETE at the top (idempotent; no-op on fresh replay
 *        since the seed never added any document_upload questions).
 *   Net result: after running this baseline on production, personalausweis_upload
 *   is gone and prod matches a fresh replay. The 20260622000001 migration remains
 *   in the chain for correctness but is a no-op going forward.
 *
 * Usage: node scripts/generate-baseline-migration.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Fetch live data ────────────────────────────────────────────────────────────

const [
  { data: categories, error: catErr },
  { data: groups, error: grpErr },
  { data: questions, error: qErr },
  { data: options, error: optErr },
] = await Promise.all([
  admin.from('category').select('*').order('sort_order'),
  admin.from('question_group').select('*').order('category_id, sort_order'),
  admin
    .from('question')
    .select('*')
    .neq('answer_type', 'document_upload') // exclude the debt question
    .order('category_id, sort_order'),
  admin.from('question_option').select('*').order('question_id, sort_order'),
])

for (const [label, err] of [
  ['category', catErr],
  ['question_group', grpErr],
  ['question', qErr],
  ['question_option', optErr],
]) {
  if (err) {
    console.error(`Error fetching ${label}:`, err.message)
    process.exit(1)
  }
}

// Filter options to only those whose question survived the document_upload filter
const qIds = new Set(questions.map((q) => q.id))
const filteredOptions = options.filter((o) => qIds.has(o.question_id))

console.log(
  `Fetched: ${categories.length} categories, ${groups.length} groups, ` +
    `${questions.length} questions (excl. doc_upload), ${filteredOptions.length} options`
)

// ── SQL helpers ────────────────────────────────────────────────────────────────

/** Escape a string value for SQL. NULL → SQL NULL literal. */
function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Escape a JSONB value. NULL → SQL NULL literal. */
function escJson(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}

// ── Build migration SQL ────────────────────────────────────────────────────────

const out = []

out.push(`-- ============================================================`)
out.push(`-- Migration: 20260702000001_baseline_questionnaire_state`)
out.push(`-- Generated: ${new Date().toISOString()}`)
out.push(`--`)
out.push(`-- Faithful snapshot of the live production questionnaire captured`)
out.push(`-- after 73 questions were added and 5 were removed via dashboard`)
out.push(`-- edits that bypassed migrations.`)
out.push(`--`)
out.push(`-- Idempotent: safe to re-run. Every statement uses ON CONFLICT DO`)
out.push(`-- UPDATE or an explicit WHERE-keyed DELETE/UPDATE so replaying`)
out.push(`-- produces the same result.`)
out.push(`--`)
out.push(`-- document_upload resolution: 20260622000001 was never applied to`)
out.push(`-- production. The DELETE below folds that intent into this baseline`)
out.push(`-- and removes personalausweis_upload from production on first run.`)
out.push(`-- ============================================================`)
out.push(``)

// ── 1. Resolve document_upload debt ──────────────────────────────────────────
out.push(`-- ─── 1. Resolve document_upload debt (20260622000001 catch-up) ─`)
out.push(`-- Idempotent: no-op on fresh replay (seed never had document_upload).`)
out.push(`-- Removes personalausweis_upload from production on first application.`)
out.push(`DELETE FROM public.question WHERE answer_type = 'document_upload';`)
out.push(``)

// ── 2. Category updates (key + label renames, by UUID) ───────────────────────
// The seed inserted 8 categories with 40000000-... UUIDs and original keys/labels.
// 3 of them had BOTH key and label_de changed via the dashboard.
// We must UPDATE by UUID (not by key) so fresh-replay works: after db reset the
// categories still have the OLD seed keys, so WHERE key='antragsteller' matches nothing.
const SEED_CATEGORIES = {
  '40000000-0000-0000-0000-000000000001': { key: 'personal', label_de: 'Persönliche Angaben' },
  '40000000-0000-0000-0000-000000000002': { key: 'home', label_de: 'Wohnverhältnisse' },
  '40000000-0000-0000-0000-000000000003': { key: 'children', label_de: 'Kinder' },
  '40000000-0000-0000-0000-000000000004': { key: 'income', label_de: 'Einkünfte' },
  '40000000-0000-0000-0000-000000000005': { key: 'expenditure', label_de: 'Ausgaben' },
  '40000000-0000-0000-0000-000000000006': { key: 'wealth', label_de: 'Vermögen' },
  '40000000-0000-0000-0000-000000000007': { key: 'additional', label_de: 'Weitere Angaben' },
  '40000000-0000-0000-0000-000000000008': { key: 'spouse', label_de: 'Ehepartner / Lebenspartner' },
}

out.push(`-- ─── 2. Category key + label renames (3 categories, by UUID) ───`)
out.push(`-- The seed inserted categories with old keys (personal, home, children).`)
out.push(`-- The dashboard renamed both key and label_de for 3 of them.`)
out.push(`-- Must use WHERE id = '...' so fresh-replay works (old keys gone after update).`)
let labelChanges = 0
for (const cat of categories) {
  const seed = SEED_CATEGORIES[cat.id]
  if (!seed) {
    // New dashboard-created category — needs INSERT, not UPDATE
    out.push(`INSERT INTO public.category (id, questionnaire_id, key, sort_order, label_de)`)
    out.push(
      `VALUES (${esc(cat.id)}, ${esc(cat.questionnaire_id)}, ${esc(cat.key)}, ${cat.sort_order}, ${esc(cat.label_de)})`
    )
    out.push(
      `ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, label_de = EXCLUDED.label_de, sort_order = EXCLUDED.sort_order;`
    )
    labelChanges++
    console.log(`  New category: ${cat.key} = "${cat.label_de}"`)
  } else if (seed.key !== cat.key || seed.label_de !== cat.label_de) {
    out.push(
      `UPDATE public.category SET key = ${esc(cat.key)}, label_de = ${esc(cat.label_de)} WHERE id = ${esc(cat.id)};`
    )
    labelChanges++
    console.log(`  Category changed: ${seed.key}→${cat.key}, "${seed.label_de}"→"${cat.label_de}"`)
  }
}
if (labelChanges === 0) out.push(`-- (no changes detected — all keys/labels match seed)`)
out.push(``)

// ── 3. Delete questions removed from production ───────────────────────────────
// These keys were in the seed (60000000-...) but were deleted via dashboard.
// The seed re-inserts them on replay, so we must delete them here.

// Detect which seed-pattern questions are missing from live
const { data: allLiveQuestions } = await admin.from('question').select('id, key')
const liveKeySet = new Set(allLiveQuestions.map((q) => q.key))

// Seed question keys (from 20260614000001 — all questions with 60000000-... UUIDs)
const KNOWN_SEED_KEYS = [
  'last_name',
  'birth_name',
  'first_name',
  'birthdate',
  'city_of_birth',
  'district_of_birth',
  'country_of_birth',
  'gender',
  'marital_status',
  'marital_status_since',
  'citizenship',
  'issuer_of_id',
  'id_expiry_date',
  'prior_social_aid',
  'prior_social_aid_until',
  'prior_social_aid_issuer',
  'prior_social_aid_reference_id',
  'power_of_attorney',
  'special_origin_rights',
  'special_origin_rights_issued',
  'special_origin_rights_issued_by',
  'disability_card',
  'disablity_card_application',
  'disability_card_expiry',
  'disability_card_markers',
  'health_insurance',
  'health_insurance_type',
  'care_level',
  'in_facility_since',
  'prior_social_service_applications',
  'last_residence_street',
  'last_residence_city',
  'last_residence_plz',
  'berlin_since',
  'berlin_district_since',
  'apartment_ownership',
  'landlord_name_and_address',
  'rent_total',
  'rent_heating',
  'rent_warm_water',
  'rent_paid_until',
  'rent_debt',
  'rent_contract_termination_yes_no',
  'rent_contract_terminated_by',
  'child_first_name',
  'child_last_name',
  'child_birth_name',
  'child_birth_date',
  'child_marital_status',
  'child_family_tie',
  'child_profession',
  'child_address',
  'pension_type',
  'pension_amount',
  'pension_id',
  'pension_issuer',
  'wohngeld_yes_no',
  'wohngeld_amount',
  'wohngeld_id',
  'other_income',
  'other_income_type',
  'other_income_amount',
  'govermental_employee',
  'health_insurance_amount',
  'care_insurance_amount',
  'general_liablity_insurance_yes_no',
  'general_liablity_insurance_provider',
  'general_liability_amount',
  'life_insurance',
  'life_insurance_monthly_amount',
  'life_insurance_total_amount',
  'life_insurance_name',
  'life_insurance_number',
  'funeral_insurance_yes_no',
  'funeral_insurance_amount',
  'funeral_insurance_detail',
  'bank_giro',
  'bank_giro_blz',
  'bank_giro_iban',
  'bank_giro_amount',
  'bank_savings_account_yes_no',
  'bank_savings_account_amount',
  'bank_savings_iban',
  'bank_additional_account_yes_no',
  'bank_additional_name',
  'bank_additional_iban',
  'bank_additional_amount',
  'cash_savings',
  'automobile_owner',
  'automobile_numbers_plate',
  'automobile_type',
  'automobile_year',
  'automobile_holder',
  'property_yes_no',
  'property_address',
  'property_usage',
  'property_size',
  'additional_wealth_yes_no',
  'additional_wealth_type',
  'additional_wealth_amount',
  'costly_diet',
  // spouse section
  'spouse_last_name',
  'spouse_birth_name',
  'spouse_first_name',
  'spouse_birthdate',
  'spouse_city_of_birth',
  'spouse_district_of_birth',
  'spouse_country_of_birth',
  'spouse_gender',
  'spouse_citizenship',
  'spouse_issuer_of_id',
  'spouse_id_expiry_date',
  'spouse_prior_social_aid',
  'spouse_prior_social_aid_until',
  'spouse_prior_social_aid_issuer',
  'spouse_prior_social_aid_reference_id',
  'spouse_power_of_attorney',
  'spouse_special_origin_rights',
  'spouse_special_origin_rights_issued',
  'spouse_special_origin_rights_issued_by',
  'spouse_disability_card',
  'spouse_disability_card_application',
  'spouse_disability_card_expiry',
  'spouse_disability_card_markers',
  'spouse_health_insurance',
  'spouse_health_insurance_type',
  'spouse_care_level',
  'spouse_in_facility_yes_no',
  'spouse_in_facility_since',
  'spouse_prior_social_service_applications',
  'spouse_pension_type',
  'spouse_pension_amount',
  'spouse_pension_id',
  'spouse_pension_issuer',
  'spouse_wohngeld_yes_no',
  'spouse_wohngeld_amount',
  'spouse_wohngeld_id',
  'spouse_other_income',
  'spouse_other_income_type',
  'spouse_other_income_amount',
  'spouse_health_insurance_amount',
  'spouse_care_insurance_amount',
  'spouse_general_liablity_insurance_yes_no',
  'spouse_general_liablity_insurance_provider',
  'spouse_general_liability_amount',
  'spouse_life_insurance',
  'spouse_life_insurance_amount',
  'spouse_bank_savings_account_amount',
  'spouse_bank_account_amount',
  'spouse_automobile_owner',
  'spouse_automobile_numbers_plate',
  'spouse_automobile_type',
  'spouse_automobile_year',
  'spouse_automobile_holder',
  'spouse_property_yes_no',
  'spouse_additional_wealth_yes_no',
  'spouse_additional_wealth_type',
  'spouse_additional_wealth_amount',
]

const deletedSeedKeys = KNOWN_SEED_KEYS.filter((k) => !liveKeySet.has(k))
out.push(`-- ─── 3. Delete seed questions removed from production ────────────`)
out.push(`-- These keys were inserted by 20260614000001 but deleted via dashboard.`)
if (deletedSeedKeys.length > 0) {
  out.push(`-- Deleted: ${deletedSeedKeys.join(', ')}`)
  out.push(`DELETE FROM public.question`)
  out.push(`WHERE key IN (${deletedSeedKeys.map(esc).join(', ')});`)
  console.log(`  Deleted seed keys: ${deletedSeedKeys.join(', ')}`)
} else {
  out.push(`-- (no deleted seed questions detected)`)
}
out.push(``)

// ── 4. Question groups (upsert all) ──────────────────────────────────────────
out.push(`-- ─── 4. Question groups ─────────────────────────────────────────`)
out.push(`INSERT INTO public.question_group`)
out.push(`  (id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count)`)
out.push(`VALUES`)
out.push(
  groups
    .map(
      (g) =>
        `  (${esc(g.id)}, ${esc(g.category_id)}, ${esc(g.key)}, ${g.sort_order},` +
        ` ${esc(g.label_de)}, ${g.is_repeatable}, ${g.min_count},` +
        ` ${g.max_count === null ? 'NULL' : g.max_count})`
    )
    .join(',\n')
)
out.push(`ON CONFLICT (id) DO UPDATE SET`)
out.push(`  label_de      = EXCLUDED.label_de,`)
out.push(`  sort_order    = EXCLUDED.sort_order,`)
out.push(`  is_repeatable = EXCLUDED.is_repeatable,`)
out.push(`  min_count     = EXCLUDED.min_count,`)
out.push(`  max_count     = EXCLUDED.max_count;`)
out.push(``)

// ── 5. Questions (upsert all, batched) ───────────────────────────────────────
out.push(`-- ─── 5. Questions (${questions.length} total, excl. document_upload) ──────────────`)
out.push(`-- ON CONFLICT DO UPDATE ensures prompt edits made in the dashboard are`)
out.push(`-- also captured, not just the new questions.`)

const Q_BATCH = 25
for (let i = 0; i < questions.length; i += Q_BATCH) {
  const batch = questions.slice(i, i + Q_BATCH)
  out.push(`INSERT INTO public.question`)
  out.push(`  (id, category_id, group_id, key, sort_order, answer_type,`)
  out.push(`   is_required, prompt_de, help_de, validation, visibility_rule)`)
  out.push(`VALUES`)
  out.push(
    batch
      .map(
        (q) =>
          `  (${esc(q.id)}, ${esc(q.category_id)}, ${q.group_id ? esc(q.group_id) : 'NULL'},` +
          ` ${esc(q.key)}, ${q.sort_order}, ${esc(q.answer_type)}::public.answer_type,` +
          ` ${q.is_required}, ${esc(q.prompt_de)},` +
          ` ${q.help_de ? esc(q.help_de) : 'NULL'},` +
          ` ${escJson(q.validation)}, ${escJson(q.visibility_rule)})`
      )
      .join(',\n')
  )
  out.push(`ON CONFLICT (id) DO UPDATE SET`)
  out.push(`  category_id     = EXCLUDED.category_id,`)
  out.push(`  group_id        = EXCLUDED.group_id,`)
  out.push(`  sort_order      = EXCLUDED.sort_order,`)
  out.push(`  answer_type     = EXCLUDED.answer_type,`)
  out.push(`  is_required     = EXCLUDED.is_required,`)
  out.push(`  prompt_de       = EXCLUDED.prompt_de,`)
  out.push(`  help_de         = EXCLUDED.help_de,`)
  out.push(`  validation      = EXCLUDED.validation,`)
  out.push(`  visibility_rule = EXCLUDED.visibility_rule;`)
  out.push(``)
}

// ── 6. Question options (upsert all, batched) ─────────────────────────────────
out.push(`-- ─── 6. Question options (${filteredOptions.length} total) ────────────────────────`)

const O_BATCH = 30
for (let i = 0; i < filteredOptions.length; i += O_BATCH) {
  const batch = filteredOptions.slice(i, i + O_BATCH)
  out.push(`INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)`)
  out.push(`VALUES`)
  out.push(
    batch
      .map(
        (o) =>
          `  (${esc(o.id)}, ${esc(o.question_id)}, ${esc(o.key)}, ${o.sort_order},` +
          ` ${esc(o.label_de)}, ${esc(o.value)})`
      )
      .join(',\n')
  )
  out.push(`ON CONFLICT (question_id, key) DO UPDATE SET`)
  out.push(`  sort_order = EXCLUDED.sort_order,`)
  out.push(`  label_de   = EXCLUDED.label_de,`)
  out.push(`  value      = EXCLUDED.value;`)
  out.push(``)
}

// ── Write output ──────────────────────────────────────────────────────────────
const OUTPUT = 'supabase/migrations/20260702000001_baseline_questionnaire_state.sql'
writeFileSync(OUTPUT, out.join('\n'), 'utf-8')

console.log(`\nWrote ${OUTPUT}`)
console.log(`  Category renames:  ${labelChanges}`)
console.log(`  Deleted seed keys: ${deletedSeedKeys.join(', ') || '(none)'}`)
console.log(`  Groups:            ${groups.length}`)
console.log(`  Questions:         ${questions.length}`)
console.log(`  Options:           ${filteredOptions.length}`)
