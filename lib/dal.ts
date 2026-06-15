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
