/**
 * Pure navigation engine — no server imports, safe for Client Components.
 *
 * Exports:
 *   isVisible           — visibility-rule predicate
 *   buildNav            — derives full nav/progress state from loaded questionnaire + saved answers
 *   formatAnswerForDisplay — human-readable German answer string for chat history
 */

import type {
  VisibilityRule,
  Question,
  Category,
  LoadedQuestionnaire,
} from './questionnaire-types'

export type { VisibilityRule, Question, Category, LoadedQuestionnaire }

// ── Visibility filter ─────────────────────────────────────────────────────────

export function isVisible(
  rule: VisibilityRule | null | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!rule) return true
  const answer = answers[(rule as { question_key: string }).question_key]
  if ('in_values' in rule) return Array.isArray(rule.in_values) && rule.in_values.includes(answer as string)
  if ('value' in rule) return answer === rule.value
  if ('not_value' in rule) return answer !== rule.not_value
  if ('not_empty' in rule) return answer !== undefined && answer !== null && answer !== ''
  return true
}

// ── Navigation types ──────────────────────────────────────────────────────────

export type NavQuestion = Question & {
  categoryId: string
  categoryLabel: string
  isAnswered: boolean
  savedValue: unknown
  /** null for non-repeatable questions; stable UUID for a specific group instance */
  instanceId: string | null
  /** 1-based index within the group; 0 for non-repeatable questions */
  instanceIndex: number
}

export type SectionNav = {
  category: Category
  navQuestions: NavQuestion[]
  openRequiredCount: number
  totalRequired: number
}

/** Returned when all questions of the last group instance are answered and more can be added. */
export type GroupPromptInfo = {
  groupKey: string
  groupLabelDe: string
  instanceCount: number
  maxCount: number | null
}

export type NavState = {
  sections: SectionNav[]
  flatVisible: NavQuestion[]
  /** First unanswered applicable question not in skippedIds — chat cursor */
  nextQuestion: NavQuestion | null
  /** First unanswered applicable required question not in skippedIds — resume target after login */
  resumeQuestion: NavQuestion | null
  /** First skipped unanswered question — re-asked when nextQuestion is null */
  nextSkippedQuestion: NavQuestion | null
  totalRequired: number
  answeredRequired: number
  progressPercent: number
  allRequiredAnswered: boolean
  /** Non-null when the user should be asked "add another?" for a completed repeatable group */
  groupPrompt: GroupPromptInfo | null
}

// ── Skip key helper ───────────────────────────────────────────────────────────

function skipKey(q: NavQuestion): string {
  return q.instanceId ? `${q.id}:${q.instanceId}` : q.id
}

// ── Navigation builder ────────────────────────────────────────────────────────

/**
 * Derives complete navigation state from a loaded questionnaire + current answers.
 * Pure — no I/O. Re-run on every answer save to recompute progress and next question.
 *
 * For repeatable groups, pass groupInstances (groupKey → ordered instanceIds) and
 * groupAnswers (instanceId → {questionKey → value}).  Both default to empty so
 * callers that don't use groups can omit them.
 *
 * dismissedGroups: set of groupKeys where the user clicked "Nein" on the "add another?"
 * prompt this session — suppresses the GroupPromptInfo for that group.
 *
 * skippedIds: compound keys (`questionId:instanceId` for group questions,
 * `questionId` for non-group) of questions the user skipped this session.
 */
export function buildNav(
  questionnaire: LoadedQuestionnaire,
  answersMap: Record<string, unknown>,
  groupInstances: Record<string, string[]> = {},
  groupAnswers: Record<string, Record<string, unknown>> = {},
  dismissedGroups: Set<string> = new Set(),
  skippedIds: Set<string> = new Set(),
): NavState {
  const sections: SectionNav[] = []
  const flatVisible: NavQuestion[] = []

  // Track which repeatable group_keys we have already expanded in this pass
  const expandedGroupKeys = new Set<string>()

  for (const cat of questionnaire.categories) {
    const navQuestions: NavQuestion[] = []

    for (const q of cat.questions) {
      if (q.answer_type === 'document_upload') continue

      // ── Repeatable group expansion ──────────────────────────────────────────
      if (q.group_is_repeatable && q.group_key) {
        if (expandedGroupKeys.has(q.group_key)) continue
        expandedGroupKeys.add(q.group_key)

        // All questions in this group for this category, in sort_order
        const groupQs = cat.questions.filter(
          (gq) => gq.group_key === q.group_key && gq.answer_type !== 'document_upload',
        )

        const instances = groupInstances[q.group_key] ?? []

        for (let idx = 0; idx < instances.length; idx++) {
          const instanceId = instances[idx]
          // Combine global answers with this instance's answers so that both
          // cross-group visibility rules (e.g. "other_income = Ja") and
          // intra-group rules (e.g. "pension_type not_empty") evaluate correctly.
          const instanceAnswers = { ...answersMap, ...(groupAnswers[instanceId] ?? {}) }

          for (const gq of groupQs) {
            if (!isVisible(gq.visibility_rule, instanceAnswers)) continue

            const rawValue = (groupAnswers[instanceId] ?? {})[gq.key]
            const isAnswered =
              rawValue !== undefined &&
              rawValue !== null &&
              rawValue !== '' &&
              !(Array.isArray(rawValue) && rawValue.length === 0)

            navQuestions.push({
              ...gq,
              categoryId: cat.id,
              categoryLabel: cat.label_de,
              isAnswered,
              savedValue: rawValue ?? null,
              instanceId,
              instanceIndex: idx + 1,
            })
          }
        }
        continue
      }

      // ── Regular (non-repeatable) question ───────────────────────────────────
      if (!isVisible(q.visibility_rule, answersMap)) continue

      const rawValue = answersMap[q.key]
      const isAnswered =
        rawValue !== undefined &&
        rawValue !== null &&
        rawValue !== '' &&
        !(Array.isArray(rawValue) && rawValue.length === 0)

      navQuestions.push({
        ...q,
        categoryId: cat.id,
        categoryLabel: cat.label_de,
        isAnswered,
        savedValue: rawValue ?? null,
        instanceId: null,
        instanceIndex: 0,
      })
    }

    flatVisible.push(...navQuestions)
    sections.push({
      category: cat,
      navQuestions,
      openRequiredCount: navQuestions.filter((q) => q.is_required && !q.isAnswered).length,
      totalRequired: navQuestions.filter((q) => q.is_required).length,
    })
  }

  const totalRequired = flatVisible.filter((q) => q.is_required).length
  const answeredRequired = flatVisible.filter((q) => q.is_required && q.isAnswered).length
  const progressPercent =
    totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 100

  const nextQuestion =
    flatVisible.find((q) => !q.isAnswered && !skippedIds.has(skipKey(q))) ?? null
  const resumeQuestion =
    flatVisible.find((q) => q.is_required && !q.isAnswered && !skippedIds.has(skipKey(q))) ?? null
  const nextSkippedQuestion =
    flatVisible.find((q) => !q.isAnswered && skippedIds.has(skipKey(q))) ?? null

  // ── Group prompt detection ──────────────────────────────────────────────────
  // Show "add another?" for the first group that:
  //  1. has visible questions in flatVisible (cross-group visibility may hide them all)
  //  2. ALL those questions are answered (sufficient guard — if the group isn't
  //     complete the user hasn't "passed" it yet, so no false positives)
  //  3. is not dismissed this session
  //  4. is not at max_count
  let groupPrompt: GroupPromptInfo | null = null

  for (const [groupKey, instances] of Object.entries(groupInstances)) {
    if (instances.length === 0) continue
    if (dismissedGroups.has(groupKey)) continue

    const groupNavQs = flatVisible.filter((q) => q.group_key === groupKey)
    if (groupNavQs.length === 0) continue  // cross-group visibility hid everything

    if (!groupNavQs.every((q) => q.isAnswered)) continue

    const maxCount = groupNavQs[0]?.group_max_count ?? null
    if (maxCount !== null && instances.length >= maxCount) continue

    groupPrompt = {
      groupKey,
      groupLabelDe: groupNavQs[0]?.group_label_de ?? groupKey,
      instanceCount: instances.length,
      maxCount,
    }
    break
  }

  return {
    sections,
    flatVisible,
    nextQuestion,
    resumeQuestion,
    nextSkippedQuestion,
    totalRequired,
    answeredRequired,
    progressPercent,
    allRequiredAnswered: totalRequired === 0 || answeredRequired === totalRequired,
    groupPrompt,
  }
}

// ── Answer display formatter ──────────────────────────────────────────────────

export function formatAnswerForDisplay(question: Question, value: unknown): string {
  if (value === null || value === undefined || value === '') return '–'

  switch (question.answer_type) {
    case 'yes_no':
      return String(value)

    case 'single_select': {
      const opt = question.options.find((o) => o.value === value)
      return opt?.label_de ?? String(value)
    }

    case 'multi_select': {
      const vals = Array.isArray(value) ? (value as string[]) : []
      if (vals.length === 0) return '–'
      return vals
        .map((v) => question.options.find((o) => o.value === v)?.label_de ?? v)
        .join(', ')
    }

    case 'date': {
      const d = new Date(String(value))
      if (isNaN(d.getTime())) return String(value)
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    case 'amount':
      return `${value} €`

    case 'address': {
      const a = value as Record<string, string>
      return `${a.street ?? ''}, ${a.plz ?? ''} ${a.city ?? ''}`.trim()
    }

    case 'person': {
      const p = value as Record<string, string>
      const birth = p.birth_date
        ? `, geb. ${new Date(p.birth_date).toLocaleDateString('de-DE')}`
        : ''
      return `${p.first_name ?? ''} ${p.last_name ?? ''}${birth}`.trim()
    }

    case 'bank_account': {
      const b = value as Record<string, string>
      return b.iban ? `IBAN: ${b.iban}` : '–'
    }

    default:
      return String(value)
  }
}
