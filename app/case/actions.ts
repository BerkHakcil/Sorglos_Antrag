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

// ── Step 3: Save an answer (M3) ───────────────────────────────────────────────

export type SaveAnswerInput = {
  questionId: string
  groupInstance: string // 'default' for non-repeating questions
  value: unknown
}

export type SaveAnswerResult = { ok: true } | { ok: false; error: string }

export async function saveAnswerAction(input: SaveAnswerInput): Promise<SaveAnswerResult> {
  const { userId } = await verifySession()
  const supabase = await createClient()

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, status, questionnaire_id')
    .eq('user_id', userId)
    .single()

  if (!caseRow) return { ok: false, error: de.case.chat.errors.generic }
  if (caseRow.status === 'under_review') return { ok: false, error: de.case.chat.errors.editLocked }

  const { data: qRow } = await supabase
    .from('question')
    .select('id, answer_type, is_required, validation, category_id')
    .eq('id', input.questionId)
    .single()

  if (!qRow) return { ok: false, error: de.case.chat.errors.generic }

  // Security: question must belong to the user's assigned questionnaire
  const { data: catRow } = await supabase
    .from('category')
    .select('id')
    .eq('id', qRow.category_id)
    .eq('questionnaire_id', caseRow.questionnaire_id)
    .maybeSingle()

  if (!catRow) return { ok: false, error: de.case.chat.errors.generic }

  const validErr = validateAnswerValue(
    qRow.answer_type,
    qRow.is_required,
    qRow.validation as Record<string, unknown> | null,
    input.value,
  )
  if (validErr) return { ok: false, error: validErr }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (supabase as any).from('answer').upsert(
    {
      case_id: caseRow.id,
      question_id: input.questionId,
      group_instance: input.groupInstance,
      value: input.value,
    },
    { onConflict: 'case_id,question_id,group_instance' },
  )

  if (upsertErr) return { ok: false, error: de.case.chat.errors.generic }

  revalidatePath('/case')
  return { ok: true }
}

// ── Step 3b: Delete a repeatable group instance ───────────────────────────────

export type DeleteGroupInstanceInput = {
  groupKey: string
  instanceId: string
}

export type DeleteGroupInstanceResult = { ok: true } | { ok: false; error: string }

export async function deleteGroupInstanceAction(
  input: DeleteGroupInstanceInput,
): Promise<DeleteGroupInstanceResult> {
  const { userId } = await verifySession()
  const supabase = await createClient()

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, status')
    .eq('user_id', userId)
    .single()

  if (!caseRow) return { ok: false, error: de.case.chat.errors.generic }
  if (caseRow.status === 'under_review') return { ok: false, error: de.case.chat.errors.editLocked }

  // Safety: this action must never delete 'default' answers
  if (!input.instanceId || input.instanceId === 'default') {
    return { ok: false, error: de.case.chat.errors.generic }
  }

  const { error } = await supabase
    .from('answer')
    .delete()
    .eq('case_id', caseRow.id)
    .eq('group_instance', input.instanceId)

  if (error) return { ok: false, error: de.case.chat.errors.generic }

  revalidatePath('/case')
  return { ok: true }
}

// ── Server-side answer validation ─────────────────────────────────────────────

function validateAnswerValue(
  answerType: string,
  isRequired: boolean,
  validation: Record<string, unknown> | null,
  value: unknown,
): string | null {
  const v = de.case.chat.validationErrors

  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  if (isRequired && isEmpty) return v.required
  if (isEmpty) return null

  switch (answerType) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return v.generic
      const minLen = validation?.min_length as number | undefined
      const maxLen = validation?.max_length as number | undefined
      if (minLen && value.length < minLen) return v.minLength.replace('{min}', String(minLen))
      if (maxLen && value.length > maxLen) return v.maxLength.replace('{max}', String(maxLen))
      return null
    }

    case 'number':
    case 'amount': {
      const num = typeof value === 'number' ? value : parseFloat(String(value))
      if (isNaN(num)) return v.invalidNumber
      const min = validation?.min as number | undefined
      const max = validation?.max as number | undefined
      if (min !== undefined && num < min) return v.invalidNumber
      if (max !== undefined && num > max) return v.invalidNumber
      return null
    }

    case 'date':
      return typeof value === 'string' && !isNaN(new Date(value).getTime()) ? null : v.invalidDate

    case 'yes_no':
      return value === 'Ja' || value === 'Nein' ? null : v.invalidYesNo

    case 'single_select':
      return typeof value === 'string' && value ? null : v.invalidSelect

    case 'multi_select':
      return Array.isArray(value) ? null : v.invalidSelect

    case 'address': {
      const a = value as Record<string, string>
      if (!a?.street?.trim() || !a?.plz?.trim() || !a?.city?.trim()) return v.invalidAddress
      return null
    }

    case 'person': {
      const p = value as Record<string, string>
      if (!p?.first_name?.trim() || !p?.last_name?.trim()) return v.invalidPerson
      return null
    }

    case 'bank_account': {
      const b = value as Record<string, string>
      if (!b?.iban?.trim()) return v.invalidIban
      return null
    }

    default:
      return null
  }
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
