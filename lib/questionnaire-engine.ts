/**
 * Questionnaire engine — DB loader.
 *
 * Pure types and navigation logic live in:
 *   lib/questionnaire-types.ts  — shared types (server + client safe)
 *   lib/questionnaire-nav.ts    — isVisible, buildNav, formatAnswerForDisplay (client safe)
 *
 * This file re-exports both so existing imports from '@/lib/questionnaire-engine' keep working.
 * Server-only: imports createClient from @/lib/supabase/server — do not import in Client Components.
 */

import { createClient } from '@/lib/supabase/server'

// ── Re-exports (backward compat) ──────────────────────────────────────────────

export type {
  VisibilityRule,
  QuestionOption,
  Question,
  Category,
  LoadedQuestionnaire,
} from './questionnaire-types'

export { isVisible } from './questionnaire-nav'

import type { Question, Category, LoadedQuestionnaire, QuestionOption } from './questionnaire-types'

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
      visibility_rule: q.visibility_rule as import('./questionnaire-types').VisibilityRule | null,
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
