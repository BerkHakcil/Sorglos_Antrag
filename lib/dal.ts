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
      'id, status, care_home_id, social_office_id, questionnaire_id, plz_before_move, plz_resolution_status, created_at, updated_at',
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
    const { data: qs } = await supabase
      .from('question')
      .select('id, key')
      .in('id', qIds)
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

/** Returns the fallback questionnaire id (social_office_id IS NULL). */
export async function getFallbackQuestionnaireId(): Promise<string> {
  await verifySession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire')
    .select('id')
    .is('social_office_id', null)
    .eq('is_active', true)
    .single()

  if (error || !data) throw new Error('Fallback-Fragebogen nicht gefunden')
  return data.id
}
