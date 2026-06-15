/**
 * Questionnaire engine — data loading and visibility filtering.
 *
 * All question definitions (prompts, types, options, order, groups) come
 * from the database. Zero question IDs or per-office logic appear here;
 * the engine is fully generic.
 *
 * Visibility filtering: a question is visible when its visibility_rule is
 * satisfied by the current set of saved answers.  With no answers (M2 display)
 * only unconditional questions (visibility_rule IS NULL) are shown — that is
 * correct behaviour; conditional questions appear as answers are saved in M3.
 */

import { createClient } from '@/lib/supabase/server'

// ── Public types ──────────────────────────────────────────────────────────────

export type VisibilityRule =
  | { question_key: string; value: string }
  | { question_key: string; not_value: string }
  | { question_key: string; not_empty: true }
  | { question_key: string; in_values: string[] }

export type QuestionOption = {
  id: string
  key: string
  sort_order: number
  label_de: string
  value: string
}

export type Question = {
  id: string
  key: string
  sort_order: number
  answer_type: string
  is_required: boolean
  prompt_de: string
  help_de: string | null
  validation: Record<string, unknown> | null
  visibility_rule: VisibilityRule | null
  group_id: string | null
  group_key: string | null
  group_label_de: string | null
  group_is_repeatable: boolean | null
  group_sort_order: number | null
  options: QuestionOption[]
}

export type Category = {
  id: string
  key: string
  sort_order: number
  label_de: string
  questions: Question[]
}

export type LoadedQuestionnaire = {
  id: string
  name: string
  categories: Category[]
}

// ── Visibility filter (pure — no I/O) ─────────────────────────────────────────

/**
 * Returns true if the question should be visible given the current answers.
 * `answers` maps question_key → JSONB value (string, boolean, etc.).
 */
export function isVisible(
  rule: VisibilityRule | null | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!rule) return true
  const answer = answers[(rule as { question_key: string }).question_key]

  if ('in_values' in rule) {
    return Array.isArray(rule.in_values) && rule.in_values.includes(answer as string)
  }
  if ('value' in rule) return answer === rule.value
  if ('not_value' in rule) return answer !== rule.not_value
  if ('not_empty' in rule) return answer !== undefined && answer !== null && answer !== ''
  return true
}

// ── DB loader ─────────────────────────────────────────────────────────────────

/**
 * Loads the full structure of a questionnaire from the database.
 * Returns categories → questions (with group metadata + options) in sort order.
 * Does NOT filter by visibility — the caller applies isVisible() as needed.
 */
export async function loadQuestionnaire(
  questionnaireId: string,
): Promise<LoadedQuestionnaire> {
  const supabase = await createClient()

  // 1. Questionnaire metadata
  const { data: qMeta, error: qErr } = await supabase
    .from('questionnaire')
    .select('id, name')
    .eq('id', questionnaireId)
    .single()
  if (qErr || !qMeta) throw new Error('Fragebogen nicht gefunden')

  // 2. Categories (sorted)
  const { data: cats, error: catErr } = await supabase
    .from('category')
    .select('id, key, sort_order, label_de')
    .eq('questionnaire_id', questionnaireId)
    .order('sort_order')
  if (catErr) throw new Error('Kategorien nicht geladen')

  if (!cats || cats.length === 0) {
    return { id: qMeta.id, name: qMeta.name, categories: [] }
  }

  const catIds = cats.map((c) => c.id)

  // 3. Questions with group join (sorted within each category)
  const { data: qs, error: qsErr } = await supabase
    .from('question')
    .select(`
      id, key, sort_order, answer_type, is_required,
      prompt_de, help_de, validation, visibility_rule, group_id, category_id,
      question_group (
        id, key, sort_order, label_de, is_repeatable
      )
    `)
    .in('category_id', catIds)
    .order('sort_order')
  if (qsErr) throw new Error('Fragen nicht geladen')

  const qIds = (qs ?? []).map((q) => q.id)

  // 4. Options (sorted)
  const { data: opts, error: optsErr } = qIds.length
    ? await supabase
        .from('question_option')
        .select('id, question_id, key, sort_order, label_de, value')
        .in('question_id', qIds)
        .order('sort_order')
    : { data: [], error: null }
  if (optsErr) throw new Error('Optionen nicht geladen')

  // 5. Assemble
  const optsByQuestion: Record<string, QuestionOption[]> = {}
  for (const opt of opts ?? []) {
    if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = []
    optsByQuestion[opt.question_id].push({
      id: opt.id,
      key: opt.key,
      sort_order: opt.sort_order,
      label_de: opt.label_de,
      value: opt.value,
    })
  }

  const qsByCategory: Record<string, Question[]> = {}
  for (const q of qs ?? []) {
    const grp = Array.isArray(q.question_group)
      ? q.question_group[0]
      : q.question_group
    const question: Question = {
      id: q.id,
      key: q.key,
      sort_order: q.sort_order,
      answer_type: q.answer_type,
      is_required: q.is_required,
      prompt_de: q.prompt_de,
      help_de: q.help_de,
      validation: q.validation as Record<string, unknown> | null,
      visibility_rule: q.visibility_rule as VisibilityRule | null,
      group_id: q.group_id,
      group_key: grp?.key ?? null,
      group_label_de: grp?.label_de ?? null,
      group_is_repeatable: grp?.is_repeatable ?? null,
      group_sort_order: grp?.sort_order ?? null,
      options: optsByQuestion[q.id] ?? [],
    }
    if (!qsByCategory[q.category_id]) qsByCategory[q.category_id] = []
    qsByCategory[q.category_id].push(question)
  }

  const categories: Category[] = cats.map((cat) => ({
    id: cat.id,
    key: cat.key,
    sort_order: cat.sort_order,
    label_de: cat.label_de,
    questions: qsByCategory[cat.id] ?? [],
  }))

  return { id: qMeta.id, name: qMeta.name, categories }
}
