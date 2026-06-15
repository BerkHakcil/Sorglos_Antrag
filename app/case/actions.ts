'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession, getFallbackQuestionnaireId } from '@/lib/dal'
import { de } from '@/lib/strings/de'

const PLZ_RE = /^\d{5}$/

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // redirect handled by proxy.ts / client redirect after session clears
  const { redirect } = await import('next/navigation')
  redirect('/login')
}

// ── Step 1: save care-home selection ──────────────────────────────────────────

export type SaveCareHomeResult = { ok: true } | { ok: false; error: string }

export async function saveCareHomeAction(careHomeId: string): Promise<SaveCareHomeResult> {
  const { userId } = await verifySession()
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .update({ care_home_id: careHomeId })
    .eq('user_id', userId)

  if (error) return { ok: false, error: de.case.careHome.errorGeneric }

  revalidatePath('/case')
  return { ok: true }
}

// ── Step 2: resolve PLZ → social office + questionnaire ───────────────────────

export type ResolvePlzResult =
  | { ok: true; status: 'resolved' | 'unsupported' }
  | { ok: false; error: string }

export async function resolvePlzAction(plz: string): Promise<ResolvePlzResult> {
  if (!PLZ_RE.test(plz.trim())) {
    return { ok: false, error: de.case.plz.errorInvalidFormat }
  }

  const { userId } = await verifySession()
  const supabase = await createClient()

  // Range query: plz_from <= plz AND plz_to >= plz, highest priority first
  const { data: rules, error: ruleErr } = await supabase
    .from('postal_code_rule')
    .select('social_office_id, priority')
    .lte('plz_from', plz)
    .gte('plz_to', plz)
    .order('priority', { ascending: false })
    .limit(1)

  if (ruleErr) return { ok: false, error: de.case.plz.errorGeneric }

  const match = rules && rules.length > 0 ? rules[0] : null

  if (match) {
    // Find the questionnaire for this social office
    const { data: qRow } = await supabase
      .from('questionnaire')
      .select('id')
      .eq('social_office_id', match.social_office_id)
      .eq('is_active', true)
      .single()

    // If no questionnaire exists for this office, use the fallback
    const questionnaireId = qRow?.id ?? (await getFallbackQuestionnaireId())

    await supabase
      .from('cases')
      .update({
        social_office_id: match.social_office_id,
        questionnaire_id: questionnaireId,
        plz_before_move: plz,
        plz_resolution_status: 'resolved',
      })
      .eq('user_id', userId)

    await supabase.from('status_event').insert({
      case_id: await getCaseId(userId, supabase),
      event_type: 'social_office_resolved',
      payload: { plz, social_office_id: match.social_office_id, questionnaire_id: questionnaireId },
    })

    revalidatePath('/case')
    return { ok: true, status: 'resolved' }
  }

  // No match — load fallback questionnaire and flag for manual handling
  const fallbackId = await getFallbackQuestionnaireId()

  await supabase
    .from('cases')
    .update({
      questionnaire_id: fallbackId,
      plz_before_move: plz,
      plz_resolution_status: 'unsupported',
    })
    .eq('user_id', userId)

  await supabase.from('status_event').insert({
    case_id: await getCaseId(userId, supabase),
    event_type: 'social_office_unresolved',
    payload: { plz, reason: 'no_matching_rule' },
  })

  revalidatePath('/case')
  return { ok: true, status: 'unsupported' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCaseId(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string> {
  const { data } = await supabase
    .from('cases')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? ''
}
