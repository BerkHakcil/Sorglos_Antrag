/**
 * Pure navigation engine — no server imports, safe for Client Components.
 *
 * Exports:
 *   isVisible   — visibility-rule predicate (also re-exported via questionnaire-engine for M2 compat)
 *   buildNav    — derives full nav/progress state from loaded questionnaire + saved answers
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
}

export type SectionNav = {
  category: Category
  navQuestions: NavQuestion[]
  openRequiredCount: number
  totalRequired: number
}

export type NavState = {
  sections: SectionNav[]
  flatVisible: NavQuestion[]
  /** First unanswered applicable question not in skippedIds — chat cursor */
  nextQuestion: NavQuestion | null
  /** First unanswered applicable required question not in skippedIds — resume target after login */
  resumeQuestion: NavQuestion | null
  totalRequired: number
  answeredRequired: number
  progressPercent: number
  allRequiredAnswered: boolean
}

// ── Navigation builder ────────────────────────────────────────────────────────

/**
 * Derives complete navigation state from a loaded questionnaire + current answers.
 * Pure — no I/O. Re-run on every answer save to recompute progress and next question.
 *
 * @param questionnaire  loaded from loadQuestionnaire()
 * @param answersMap     question_key → JSONB value (from getCaseAnswers())
 * @param skippedIds     question IDs skipped this session — client state only, not persisted
 */
export function buildNav(
  questionnaire: LoadedQuestionnaire,
  answersMap: Record<string, unknown>,
  skippedIds: Set<string> = new Set(),
): NavState {
  const sections: SectionNav[] = []
  const flatVisible: NavQuestion[] = []

  for (const cat of questionnaire.categories) {
    const navQuestions: NavQuestion[] = []

    for (const q of cat.questions) {
      if (!isVisible(q.visibility_rule, answersMap)) continue

      const rawValue = answersMap[q.key]
      const isAnswered = rawValue !== undefined && rawValue !== null && rawValue !== '' &&
        !(Array.isArray(rawValue) && rawValue.length === 0)

      navQuestions.push({
        ...q,
        categoryId: cat.id,
        categoryLabel: cat.label_de,
        isAnswered,
        savedValue: rawValue ?? null,
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
    flatVisible.find((q) => !q.isAnswered && !skippedIds.has(q.id)) ?? null
  const resumeQuestion =
    flatVisible.find((q) => q.is_required && !q.isAnswered && !skippedIds.has(q.id)) ?? null

  return {
    sections,
    flatVisible,
    nextQuestion,
    resumeQuestion,
    totalRequired,
    answeredRequired,
    progressPercent,
    allRequiredAnswered: totalRequired === 0 || answeredRequired === totalRequired,
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
