import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  const { data: answers, error } = await supabase
    .from('answer')
    .select('question_id, group_instance, value')
    .eq('case_id', caseId)

  if (error) throw new Error('Antworten konnten nicht geladen werden')

  const rows = answers ?? []
  const qIds = [...new Set(rows.map((r) => r.question_id))]

  const keyMap: Record<string, string> = {}
  if (qIds.length > 0) {
    const { data: qs } = await supabase.from('question').select('id, key').in('id', qIds)
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
