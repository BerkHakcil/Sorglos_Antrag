import { describe, it, expect } from 'vitest'
import { isVisible, type VisibilityRule, type Question } from '@/lib/questionnaire-engine'
import { buildNav, type LoadedQuestionnaire } from '@/lib/questionnaire-nav'

// ─── Helpers ──────────────────────────────────────────────

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    key: 'test_question',
    sort_order: 0,
    answer_type: 'short_text',
    is_required: true,
    prompt_de: 'Test Frage?',
    help_de: null,
    validation: null,
    visibility_rule: null,
    group_id: null,
    group_key: null,
    group_label_de: null,
    group_is_repeatable: null,
    group_sort_order: null,
    group_min_count: null,
    group_max_count: null,
    options: [],
    ...overrides,
  }
}

// ─── isVisible — null rule ─────────────────────────────────

describe('isVisible — unconditional question', () => {
  it('is visible with no rule and empty answers', () => {
    expect(isVisible(null, {})).toBe(true)
  })

  it('is visible with no rule and non-empty answers', () => {
    expect(isVisible(null, { some_key: 'value' })).toBe(true)
  })
})

// ─── isVisible — value rule ───────────────────────────────

describe('isVisible — value rule', () => {
  const rule: VisibilityRule = { question_key: 'prior_social_aid', value: 'Ja' }

  it('is visible when answer matches', () => {
    expect(isVisible(rule, { prior_social_aid: 'Ja' })).toBe(true)
  })

  it('is hidden when answer differs', () => {
    expect(isVisible(rule, { prior_social_aid: 'Nein' })).toBe(false)
  })

  it('is hidden when answer is absent (M2 initial state)', () => {
    expect(isVisible(rule, {})).toBe(false)
  })
})

// ─── isVisible — not_value rule ───────────────────────────

describe('isVisible — not_value rule', () => {
  const rule: VisibilityRule = { question_key: 'special_origin_rights', not_value: 'Nein' }

  it('is visible when answer differs from the excluded value', () => {
    expect(isVisible(rule, { special_origin_rights: 'Spätaussiedler' })).toBe(true)
  })

  it('is hidden when answer equals the excluded value', () => {
    expect(isVisible(rule, { special_origin_rights: 'Nein' })).toBe(false)
  })

  it('is hidden when answer is absent (undefined !== "Nein" is true, but…)', () => {
    // No answer → undefined !== 'Nein' → true; question appears
    expect(isVisible(rule, {})).toBe(true)
  })
})

// ─── isVisible — not_empty rule ───────────────────────────

describe('isVisible — not_empty rule', () => {
  const rule: VisibilityRule = { question_key: 'pension_type', not_empty: true }

  it('is visible when answer is non-empty', () => {
    expect(isVisible(rule, { pension_type: 'Altersrente' })).toBe(true)
  })

  it('is hidden when answer is empty string', () => {
    expect(isVisible(rule, { pension_type: '' })).toBe(false)
  })

  it('is hidden when answer is absent', () => {
    expect(isVisible(rule, {})).toBe(false)
  })

  it('is hidden when answer is null', () => {
    expect(isVisible(rule, { pension_type: null })).toBe(false)
  })
})

// ─── isVisible — in_values rule ───────────────────────────

describe('isVisible — in_values rule (spouse section)', () => {
  const rule: VisibilityRule = {
    question_key: 'marital_status',
    in_values: ['verheiratet', 'eingetragene Lebenspartnerschaft', 'dauernd getrennt lebend', 'eheähnliche Gemeinschaft'],
  }

  it('is visible for a status with a partner', () => {
    expect(isVisible(rule, { marital_status: 'verheiratet' })).toBe(true)
    expect(isVisible(rule, { marital_status: 'eingetragene Lebenspartnerschaft' })).toBe(true)
    expect(isVisible(rule, { marital_status: 'dauernd getrennt lebend' })).toBe(true)
  })

  it('is hidden for ledig or verwitwet', () => {
    expect(isVisible(rule, { marital_status: 'ledig' })).toBe(false)
    expect(isVisible(rule, { marital_status: 'verwitwet' })).toBe(false)
    expect(isVisible(rule, { marital_status: 'geschieden' })).toBe(false)
  })

  it('is hidden when marital_status is not yet answered (M2 initial)', () => {
    expect(isVisible(rule, {})).toBe(false)
  })
})

// ─── Category filtering — sort order ──────────────────────

describe('category question ordering', () => {
  const questions: Question[] = [
    makeQuestion({ id: 'q3', key: 'last_name',   sort_order: 2, visibility_rule: null }),
    makeQuestion({ id: 'q1', key: 'first_name',  sort_order: 0, visibility_rule: null }),
    makeQuestion({ id: 'q2', key: 'birth_name',  sort_order: 1, visibility_rule: null }),
    makeQuestion({ id: 'q4', key: 'conditional', sort_order: 3,
      visibility_rule: { question_key: 'prior_social_aid', value: 'Ja' } }),
  ]

  it('visible questions appear in sort_order order', () => {
    const visible = questions
      .filter((q) => isVisible(q.visibility_rule, {}))
      .sort((a, b) => a.sort_order - b.sort_order)
    expect(visible.map((q) => q.key)).toEqual(['first_name', 'birth_name', 'last_name'])
  })

  it('conditional question is hidden when answer is absent', () => {
    const visible = questions.filter((q) => isVisible(q.visibility_rule, {}))
    expect(visible.find((q) => q.key === 'conditional')).toBeUndefined()
  })

  it('conditional question appears once answer is provided', () => {
    const visible = questions.filter((q) =>
      isVisible(q.visibility_rule, { prior_social_aid: 'Ja' })
    )
    expect(visible.find((q) => q.key === 'conditional')).toBeDefined()
    expect(visible).toHaveLength(4)
  })
})

// ─── buildNav — helpers ────────────────────────────────────

function makeQuestionnaire(questionOverrides: Partial<Question>[]): LoadedQuestionnaire {
  return {
    id: 'qn1',
    name: 'Test',
    categories: [
      {
        id: 'cat1',
        key: 'cat1',
        sort_order: 0,
        label_de: 'Kategorie 1',
        questions: questionOverrides.map((o, i) =>
          makeQuestion({ id: `q${i}`, key: `q${i}`, sort_order: i, ...o }),
        ),
      },
    ],
  }
}

// ─── buildNav — progress denominator ─────────────────────

describe('buildNav — progress denominator', () => {
  it('counts only visible required questions', () => {
    const q = makeQuestionnaire([
      { key: 'trigger', is_required: true },
      {
        key: 'conditional',
        is_required: true,
        sort_order: 1,
        visibility_rule: { question_key: 'trigger', value: 'Ja' },
      },
    ])
    // trigger not yet answered → conditional hidden → denominator = 1
    expect(buildNav(q, {}).totalRequired).toBe(1)
  })

  it('denominator grows when trigger is answered and conditional becomes visible', () => {
    const q = makeQuestionnaire([
      { key: 'trigger', is_required: true },
      {
        key: 'conditional',
        is_required: true,
        sort_order: 1,
        visibility_rule: { question_key: 'trigger', value: 'Ja' },
      },
    ])
    expect(buildNav(q, { trigger: 'Ja' }).totalRequired).toBe(2)
  })

  it('optional questions do not count toward denominator', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: false, sort_order: 1 },
    ])
    expect(buildNav(q, {}).totalRequired).toBe(1)
  })
})

// ─── buildNav — answered count and progress ───────────────

describe('buildNav — answered count and progressPercent', () => {
  it('starts at 0% with no answers', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: true, sort_order: 1 },
    ])
    const nav = buildNav(q, {})
    expect(nav.answeredRequired).toBe(0)
    expect(nav.progressPercent).toBe(0)
    expect(nav.allRequiredAnswered).toBe(false)
  })

  it('reaches 100% when all required are answered', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: true, sort_order: 1 },
    ])
    const nav = buildNav(q, { a: 'yes', b: 'no' })
    expect(nav.answeredRequired).toBe(2)
    expect(nav.progressPercent).toBe(100)
    expect(nav.allRequiredAnswered).toBe(true)
  })

  it('optional answered questions are not counted in answeredRequired', () => {
    const q = makeQuestionnaire([
      { key: 'req', is_required: true },
      { key: 'opt', is_required: false, sort_order: 1 },
    ])
    const nav = buildNav(q, { req: 'x', opt: 'y' })
    expect(nav.answeredRequired).toBe(1)
    expect(nav.totalRequired).toBe(1)
  })

  it('empty questionnaire → 100% progress', () => {
    const q: LoadedQuestionnaire = { id: 'x', name: 'Empty', categories: [] }
    const nav = buildNav(q, {})
    expect(nav.progressPercent).toBe(100)
    expect(nav.allRequiredAnswered).toBe(true)
  })
})

// ─── buildNav — nextQuestion / resumeQuestion ─────────────

describe('buildNav — nextQuestion and resumeQuestion', () => {
  it('nextQuestion is the first unanswered question', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: false, sort_order: 1 },
    ])
    const nav = buildNav(q, { a: 'yes' })
    expect(nav.nextQuestion?.key).toBe('b')
  })

  it('skipped question is excluded from nextQuestion', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: true, sort_order: 1 },
    ])
    const nav = buildNav(q, {}, {}, {}, new Set(), new Set(['q0']))
    expect(nav.nextQuestion?.key).toBe('b')
  })

  it('resumeQuestion skips optional unanswered in favour of first required', () => {
    const q = makeQuestionnaire([
      { key: 'opt', is_required: false },
      { key: 'req', is_required: true, sort_order: 1 },
    ])
    const nav = buildNav(q, {})
    // nextQuestion = first unanswered (optional first), resumeQuestion = first required
    expect(nav.nextQuestion?.key).toBe('opt')
    expect(nav.resumeQuestion?.key).toBe('req')
  })

  it('nextQuestion is null when everything is answered or skipped', () => {
    const q = makeQuestionnaire([{ key: 'a', is_required: true }])
    const nav = buildNav(q, { a: 'yes' })
    expect(nav.nextQuestion).toBeNull()
  })

  it('nextSkippedQuestion returns the first skipped unanswered question', () => {
    const q = makeQuestionnaire([
      { key: 'a', is_required: true },
      { key: 'b', is_required: true, sort_order: 1 },
    ])
    const nav = buildNav(q, {}, {}, {}, new Set(), new Set(['q0']))
    expect(nav.nextQuestion?.key).toBe('b')
    expect(nav.nextSkippedQuestion?.key).toBe('a')
  })

  it('nextSkippedQuestion is null when no questions are skipped', () => {
    const q = makeQuestionnaire([{ key: 'a', is_required: true }])
    expect(buildNav(q, {}).nextSkippedQuestion).toBeNull()
  })

  it('document_upload questions are excluded from buildNav', () => {
    const q = makeQuestionnaire([
      { key: 'name', is_required: true, answer_type: 'short_text' },
      { key: 'doc', is_required: true, answer_type: 'document_upload', sort_order: 1 },
    ])
    const nav = buildNav(q, {})
    expect(nav.flatVisible.map((q) => q.key)).toEqual(['name'])
    expect(nav.totalRequired).toBe(1)
  })
})

// ─── buildNav — per-section openRequiredCount ─────────────

describe('buildNav — per-section openRequiredCount', () => {
  it('section counts open required correctly', () => {
    const questionnaire: LoadedQuestionnaire = {
      id: 'qn',
      name: 'Multi-section',
      categories: [
        {
          id: 'cat1',
          key: 'cat1',
          sort_order: 0,
          label_de: 'Sektion 1',
          questions: [
            makeQuestion({ id: 'q0', key: 'a', is_required: true, sort_order: 0 }),
            makeQuestion({ id: 'q1', key: 'b', is_required: true, sort_order: 1 }),
          ],
        },
        {
          id: 'cat2',
          key: 'cat2',
          sort_order: 1,
          label_de: 'Sektion 2',
          questions: [
            makeQuestion({ id: 'q2', key: 'c', is_required: true, sort_order: 0 }),
          ],
        },
      ],
    }

    const nav = buildNav(questionnaire, { a: 'yes' })
    expect(nav.sections[0].openRequiredCount).toBe(1) // b still open
    expect(nav.sections[1].openRequiredCount).toBe(1) // c open
    expect(nav.sections[0].totalRequired).toBe(2)
    expect(nav.sections[1].totalRequired).toBe(1)
  })
})
