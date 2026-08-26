import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  resolveEffectiveRules,
  parseDefaultOfficeId,
  parseExcludedRuleIds,
  DEFAULT_OFFICE_CONFIG_KEY,
  FALLBACK_EXCLUSIONS_CONFIG_KEY,
} from '@/lib/rules-source'

/**
 * Primary identity check for protected Server Components and Server Actions.
 *
 * Uses getClaims() — validates the JWT locally against Supabase's published
 * public keys. No network roundtrip unless the token needs refreshing (proxy.ts
 * handles that before this render). Never use getSession() in server code.
 *
 * Redirects to /login if unauthenticated; returns the verified user ID otherwise.
 */
export async function verifySession(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  const userId = data?.claims?.sub
  if (!userId) {
    redirect('/login')
  }

  return { userId }
}

/**
 * Returns the caller's case row with all M2 fields.
 * Always exists — created atomically by handle_new_user() on signup.
 */
export async function getCase() {
  const { userId } = await verifySession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cases')
    .select(
      'id, status, care_home_id, social_office_id, questionnaire_id, plz_before_move, plz_resolution_status, created_at, updated_at'
    )
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error('Kein Fall gefunden')
  }

  return data
}

/** Returns all active care homes for the care-home selector. */
export async function getCareHomes() {
  await verifySession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('care_home')
    .select('id, name, address')
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error('Pflegeheime nicht geladen')
  return data ?? []
}

// ── Answer loading (M3) ───────────────────────────────────────────────────────

export type SavedAnswer = {
  question_id: string
  question_key: string
  group_instance: string
  value: unknown
}

/**
 * Loads all saved answers for a case.
 * Caller must supply a caseId obtained from getCase() — ownership is already verified there.
 *
 * Returns:
 *   answersMap  — question_key → value for 'default' instance (used by isVisible / buildNav)
 *   answersRaw  — every row including repeatable group instances
 */
export async function getCaseAnswers(caseId: string): Promise<{
  answersMap: Record<string, unknown>
  answersRaw: SavedAnswer[]
}> {
  const supabase = await createClient()

  // created_at order makes repeatable-group instance order DETERMINISTIC
  // (pass 4 / D15): deriveGroupData keeps instances in first-seen order, so
  // the rows must arrive oldest-first — count-capping truncates from the END.
  const { data: answers, error } = await supabase
    .from('answer')
    .select('question_id, group_instance, value')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Antworten konnten nicht geladen werden')

  const rows = answers ?? []
  const qIds = [...new Set(rows.map((r) => r.question_id))]

  // ⚠ active = true is LOAD-BEARING, not symmetry (pass 4 / D15): rows whose
  // question is missing from this map are skipped below, so a RETIRED
  // question's preserved answers (hat_rente / rentenbetrag) never enter
  // answersRaw — and the stale-answer sweep in saveAnswerAction can only
  // delete refs that appear in answersRaw. Filtering ONLY the loader would
  // get those answers deleted on the user's next save. Design of record:
  // docs/feedback/pass4_phase_a.md §A1.2.
  const keyMap: Record<string, string> = {}
  if (qIds.length > 0) {
    const { data: qs } = await supabase
      .from('question')
      .select('id, key')
      .in('id', qIds)
      .eq('active', true)
    for (const q of qs ?? []) keyMap[q.id] = q.key
  }

  const answersMap: Record<string, unknown> = {}
  const answersRaw: SavedAnswer[] = []

  for (const row of rows) {
    const key = keyMap[row.question_id]
    if (!key) continue

    answersRaw.push({
      question_id: row.question_id,
      question_key: key,
      group_instance: row.group_instance,
      value: row.value,
    })

    if (row.group_instance === 'default') {
      answersMap[key] = row.value
    }
  }

  return { answersMap, answersRaw }
}

// ── Static UI copy (CLAUDE.md rule #2) ─────────────────────────────────────────

/** Header/footer chrome copy, sourced from public.static_content. */
export type StaticContent = {
  brandTagline: string
  caseSubheading: string
  patientBannerTitle: string
  patientBannerBody: string
  allAnsweredHeading: string
  allAnsweredMessage: string
  lockedHeading: string
  lockedBody: string
  lockedDocsHeading: string
  lockedDocsBody: string
  lockedDocsButton: string
  nextStepsUpload: string
  docsAreaTitle: string
  docsAreaIntro: string
  docsStatusMissing: string
  docsStatusUploaded: string
  docsUploadButton: string
  docsDeleteButton: string
  docsErrorType: string
  docsErrorSize: string
  docsErrorGeneric: string
  docsHeadingPerson1: string
  docsHeadingPerson2: string
  docsHeadingPreviousHome: string
  docsMissingCount: string
  docsMissingCountOne: string
  docsAllUploaded: string
  docsPlaceholderNeedsPlz: string
  docsPeriodSuffix: string
  nextStepsHeading: string
  nextSteps1: string
  nextSteps2: string
  nextSteps3: string
  contactName: string
  contactPhone: string
  contactEmail: string
  contactCardLabel: string
  contactHelpButton: string
  headerTitlePattern: string
  headerIntroDocuments: string
  autosaveNotice: string
}

const STATIC_CONTENT_KEYS: Record<keyof StaticContent, string> = {
  brandTagline: 'brand.tagline',
  caseSubheading: 'case.subheading',
  patientBannerTitle: 'case.patient_banner_title',
  patientBannerBody: 'case.patient_banner_body',
  allAnsweredHeading: 'case.all_answered_heading',
  allAnsweredMessage: 'case.all_answered_message',
  lockedHeading: 'case.locked_heading',
  lockedBody: 'case.locked_body',
  // Item 3 (go-live round 2): docs-aware locked-card variant. All four texts
  // are FINAL (approved by Erman 2026-08-13, Roman review waived);
  // ''-degradation stays as the structural rollout contract (the variant
  // condition requires non-empty heading+body).
  lockedDocsHeading: 'case.locked_docs_heading',
  lockedDocsBody: 'case.locked_docs_body',
  lockedDocsButton: 'case.locked_docs_button',
  nextStepsUpload: 'case.next_steps_upload',
  docsAreaTitle: 'docs.area_title',
  docsAreaIntro: 'docs.area_intro',
  docsStatusMissing: 'docs.status_missing',
  docsStatusUploaded: 'docs.status_uploaded',
  docsUploadButton: 'docs.upload_button',
  docsDeleteButton: 'docs.delete_button',
  docsErrorType: 'docs.error_type',
  docsErrorSize: 'docs.error_size',
  docsErrorGeneric: 'docs.error_generic',
  docsHeadingPerson1: 'docs.heading_person_1',
  docsHeadingPerson2: 'docs.heading_person_2',
  docsHeadingPreviousHome: 'docs.heading_previous_home',
  docsMissingCount: 'docs.missing_count',
  docsMissingCountOne: 'docs.missing_count_one',
  docsAllUploaded: 'docs.all_uploaded',
  docsPlaceholderNeedsPlz: 'docs.placeholder_needs_plz',
  docsPeriodSuffix: 'docs.period_suffix',
  // docs.fallback_notice is deliberately NOT mapped since 2026-08-26: the
  // fallback banner was removed (fallback-docs fix, Gate 1). The DB row stays
  // — getStaticContent only surfaces mapped keys, so the row is inert.
  nextStepsHeading: 'case.next_steps_heading',
  nextSteps1: 'case.next_steps_1',
  nextSteps2: 'case.next_steps_2',
  nextSteps3: 'case.next_steps_3',
  contactName: 'contact.name',
  contactPhone: 'contact.phone',
  contactEmail: 'contact.email',
  contactCardLabel: 'contact.card_label',
  contactHelpButton: 'contact.help_button',
  // UI round 2 (R2-2/R2-3). Mockup-adopted copy under the 2026-08-14 waiver;
  // migration 20260814000001. Missing rows degrade to '' like every other key,
  // so the header falls back to case.subheading and the autosave hint simply
  // does not render.
  headerTitlePattern: 'case.header_title_pattern',
  headerIntroDocuments: 'case.header_intro_documents',
  autosaveNotice: 'case.autosave_notice',
}

/**
 * Loads header/footer copy from the DB. German prose lives only in the DB —
 * never hardcoded here (CLAUDE.md rule #2). Missing keys / load errors degrade
 * to an empty string rather than throwing, so a content gap never errors the page.
 */
export async function getStaticContent(): Promise<StaticContent> {
  const supabase = await createClient()
  // static_content is not in the generated DB types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('static_content').select('key, value_de')

  const byKey: Record<string, string> = {}
  if (error) {
    console.error('[getStaticContent] load failed:', error.message)
  } else {
    for (const row of (data ?? []) as { key: string; value_de: string }[]) {
      byKey[row.key] = row.value_de
    }
  }

  const out = {} as StaticContent
  for (const field of Object.keys(STATIC_CONTENT_KEYS) as (keyof StaticContent)[]) {
    out[field] = byKey[STATIC_CONTENT_KEYS[field]] ?? ''
  }
  return out
}

// getFallbackQuestionnaireId removed (CP3/D12): unresolved PLZs now get the
// Berlin questionnaire (DEFAULT_QUESTIONNAIRE_ID in app/case/actions.ts); the
// empty "Allgemeiner Fragebogen" row was deactivated by migration.

// ── M5: document rules + uploads ──────────────────────────────────────────────

export type UploadRow = {
  id: string
  rule_id: string
  document_id: string
  subject: string
  instance_key: string
  storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number
}

// RulesSource + the ladder decision live in lib/rules-source.ts since the
// fallback-docs fix (2026-08-26) — one shared, pure, unit-tested module for
// this file and scripts/case-export.mjs, which previously carried a hand-
// synced copy that had drifted once (go-live follow-up, 2026-08-11).
export type { RulesSource } from '@/lib/rules-source'

/**
 * Rules + catalog for the case's resolved office, and the case's uploads.
 * Returns empty rules when no office has document rules (D5: the document
 * area simply doesn't render).
 */
export async function getDocumentData(caseId: string, socialOfficeId: string | null) {
  await verifySession()
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // An office WITH rules always uses its own (feedback pass item 3).
  // `active = false` rules are retired content (pass 3 item 5, PAN-011) — they
  // stay in the table so existing uploads keep their FK, but never emit a slot.
  let ownRules: { id: string }[] = []
  if (socialOfficeId) {
    const { data } = await sb
      .from('office_document_rule')
      .select('*')
      .eq('social_office_id', socialOfficeId)
      .eq('active', true)
    ownRules = data ?? []
  }

  // Default-office fallback: rule-less offices AND office-less (unsupported-PLZ)
  // cases use the configured default rule set (app_config
  // default_document_office_id, changed by migration only) MINUS the fallback
  // exclusions (fallback_excluded_rule_ids — the default office's house-
  // specific entries, Gate 1 / Line A). Both config reads degrade silently:
  // no default → no rules → no tab; no/malformed exclusion row → no
  // exclusions, i.e. the pre-fix list (benign deploy ordering — the code may
  // ship before the migration row lands). Decision logic + failure semantics
  // live in lib/rules-source.ts, shared with scripts/case-export.mjs.
  let defaultOfficeId: string | null = null
  let excludedRuleIds: string[] = []
  let defaultRules: { id: string }[] = []
  if (ownRules.length === 0) {
    const { data: cfgRows } = await sb
      .from('app_config')
      .select('key, value')
      .in('key', [DEFAULT_OFFICE_CONFIG_KEY, FALLBACK_EXCLUSIONS_CONFIG_KEY])
    for (const row of (cfgRows ?? []) as { key: string; value: unknown }[]) {
      if (row.key === DEFAULT_OFFICE_CONFIG_KEY) defaultOfficeId = parseDefaultOfficeId(row.value)
      if (row.key === FALLBACK_EXCLUSIONS_CONFIG_KEY)
        excludedRuleIds = parseExcludedRuleIds(row.value)
    }
    if (defaultOfficeId && defaultOfficeId !== socialOfficeId) {
      const { data } = await sb
        .from('office_document_rule')
        .select('*')
        .eq('social_office_id', defaultOfficeId)
        .eq('active', true)
      defaultRules = data ?? []
    }
  }

  const { rules, rulesSource } = resolveEffectiveRules({
    socialOfficeId,
    ownRules,
    defaultOfficeId,
    defaultRules,
    excludedRuleIds,
  })

  const [{ data: catalog }, { data: uploads }] = await Promise.all([
    sb.from('document_catalog').select('*').eq('active', true),
    sb.from('document_upload').select('*').eq('case_id', caseId).order('created_at'),
  ])
  const catalogById: Record<string, { id: string; name_de: string; category: string }> = {}
  for (const c of catalog ?? []) catalogById[c.id] = c
  return {
    rules: (rules ?? []) as never[],
    rulesSource,
    catalog: catalogById,
    uploads: (uploads ?? []) as UploadRow[],
  }
}
