import { describe, it, expect } from 'vitest'
import { isVisible, type VisibilityRule, type Question } from '@/lib/questionnaire-engine'
import {
  buildNav,
  buildRulesByKey,
  findStaleAnswerRefs,
  type LoadedQuestionnaire,
} from '@/lib/questionnaire-nav'

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
    group_custom_prompt_de: null,
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

// ─── isVisible — includes rule (multi-select controller) ──

describe('isVisible — includes rule', () => {
  const rule: VisibilityRule = {
    question_key: 'wealth_bulk_topics',
    includes: 'Es gibt Wertpapiere oder Aktien',
  }

  it('is visible when the multi-select answer contains the option', () => {
    expect(
      isVisible(rule, { wealth_bulk_topics: ['Es gibt Wertpapiere oder Aktien', 'Anderes'] })
    ).toBe(true)
  })

  it('is hidden when the option is not selected', () => {
    expect(isVisible(rule, { wealth_bulk_topics: ['Nein, nichts davon'] })).toBe(false)
  })

  it('is hidden when the controller is unanswered', () => {
    expect(isVisible(rule, {})).toBe(false)
  })

  it('is hidden when the answer is not an array (bad data)', () => {
    expect(isVisible(rule, { wealth_bulk_topics: 'Es gibt Wertpapiere oder Aktien' })).toBe(false)
  })

  it('chains transitively through a hidden multi-select controller', () => {
    // detail ← includes ← bulk ← marital gate; single applicant hides the bulk,
    // so the detail must stay hidden even if a stale array answer matched.
    const rules = new Map<string, VisibilityRule | null>([
      ['spouse_bulk', { question_key: 'marital_status', in_values: ['verheiratet'] }],
      ['detail', { question_key: 'spouse_bulk', includes: 'X' }],
    ])
    expect(
      isVisible(
        { question_key: 'spouse_bulk', includes: 'X' },
        { spouse_bulk: ['X'], marital_status: 'ledig' },
        rules
      )
    ).toBe(false)
    expect(
      isVisible(
        { question_key: 'spouse_bulk', includes: 'X' },
        { spouse_bulk: ['X'], marital_status: 'verheiratet' },
        rules
      )
    ).toBe(true)
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
    in_values: [
      'verheiratet',
      'eingetragene Lebenspartnerschaft',
      'dauernd getrennt lebend',
      'eheähnliche Gemeinschaft',
    ],
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
    makeQuestion({ id: 'q3', key: 'last_name', sort_order: 2, visibility_rule: null }),
    makeQuestion({ id: 'q1', key: 'first_name', sort_order: 0, visibility_rule: null }),
    makeQuestion({ id: 'q2', key: 'birth_name', sort_order: 1, visibility_rule: null }),
    makeQuestion({
      id: 'q4',
      key: 'conditional',
      sort_order: 3,
      visibility_rule: { question_key: 'prior_social_aid', value: 'Ja' },
    }),
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
          makeQuestion({ id: `q${i}`, key: `q${i}`, sort_order: i, ...o })
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
          questions: [makeQuestion({ id: 'q2', key: 'c', is_required: true, sort_order: 0 })],
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

// ─── isVisible — transitive controller chain (BUG A) ──────

describe('isVisible — transitive visibility (controller chain)', () => {
  // marital_status (unconditional)
  //   → spouse_special_origin_rights        (visible only for a spouse-equivalent status)
  //       → spouse_special_origin_rights_issued      (visible when parent != "Nein")
  //           → spouse_special_origin_rights_issued_by (grandchild; parent not_empty)
  const chain = makeQuestionnaire([
    { key: 'marital_status', is_required: true },
    {
      key: 'spouse_special_origin_rights',
      is_required: true,
      sort_order: 1,
      visibility_rule: { question_key: 'marital_status', in_values: ['verheiratet'] },
    },
    {
      key: 'spouse_special_origin_rights_issued',
      is_required: true,
      sort_order: 2,
      visibility_rule: { question_key: 'spouse_special_origin_rights', not_value: 'Nein' },
    },
    {
      key: 'spouse_special_origin_rights_issued_by',
      is_required: true,
      sort_order: 3,
      visibility_rule: { question_key: 'spouse_special_origin_rights_issued', not_empty: true },
    },
  ])
  const rules = buildRulesByKey(chain)
  const issuedRule = chain.categories[0].questions[2].visibility_rule
  const issuedByRule = chain.categories[0].questions[3].visibility_rule

  it('a question with no rule is always visible', () => {
    expect(isVisible(null, {}, rules)).toBe(true)
    expect(isVisible(null, { marital_status: 'ledig' }, rules)).toBe(true)
  })

  it('gated on a VISIBLE controller behaves as before', () => {
    // married → controller visible; issued shows when controller != "Nein"
    expect(
      isVisible(
        issuedRule,
        { marital_status: 'verheiratet', spouse_special_origin_rights: 'Spätaussiedler' },
        rules
      )
    ).toBe(true)
    // married + controller == "Nein" → issued hidden
    expect(
      isVisible(
        issuedRule,
        { marital_status: 'verheiratet', spouse_special_origin_rights: 'Nein' },
        rules
      )
    ).toBe(false)
  })

  it('gated on a HIDDEN controller resolves to hidden, regardless of stored value', () => {
    // single → controller (spouse_special_origin_rights) is hidden. Even with a
    // stale "Spätaussiedler" value stored, the child must now be hidden.
    const answers = { marital_status: 'ledig', spouse_special_origin_rights: 'Spätaussiedler' }
    expect(isVisible(issuedRule, answers, rules)).toBe(false)
    // Legacy one-level check (no map) would wrongly return true — this was the bug.
    expect(isVisible(issuedRule, answers)).toBe(true)
  })

  it('recurses multi-level (grandchild hidden when a top ancestor is hidden)', () => {
    const answers = {
      marital_status: 'ledig',
      spouse_special_origin_rights: 'Spätaussiedler',
      spouse_special_origin_rights_issued: '1990-01-01',
    }
    expect(isVisible(issuedByRule, answers, rules)).toBe(false)
    // When married the whole chain is satisfied → grandchild visible.
    expect(isVisible(issuedByRule, { ...answers, marital_status: 'verheiratet' }, rules)).toBe(true)
  })

  it('buildNav excludes transitively-hidden questions from the denominator', () => {
    const nav = buildNav(chain, {
      marital_status: 'ledig',
      spouse_special_origin_rights: 'Spätaussiedler',
      spouse_special_origin_rights_issued: '1990-01-01',
    })
    expect(nav.flatVisible.map((q) => q.key)).toEqual(['marital_status'])
    expect(nav.totalRequired).toBe(1)
  })
})

// ─── findStaleAnswerRefs (BUG B) ──────────────────────────

describe('findStaleAnswerRefs', () => {
  const chain = makeQuestionnaire([
    { key: 'marital_status', is_required: true },
    {
      key: 'spouse_special_origin_rights',
      is_required: true,
      sort_order: 1,
      visibility_rule: { question_key: 'marital_status', in_values: ['verheiratet'] },
    },
  ])

  it('flags answer rows whose question is not currently visible', () => {
    // single → spouse_special_origin_rights hidden, but it has a saved answer.
    const nav = buildNav(chain, {
      marital_status: 'ledig',
      spouse_special_origin_rights: 'Spätaussiedler',
    })
    const answersRaw = [
      { question_id: 'q0', question_key: 'marital_status', group_instance: 'default' },
      {
        question_id: 'q1',
        question_key: 'spouse_special_origin_rights',
        group_instance: 'default',
      },
    ]
    const stale = findStaleAnswerRefs(nav.flatVisible, answersRaw)
    expect(stale.map((s) => s.question_key)).toEqual(['spouse_special_origin_rights'])
  })

  it('returns nothing when every answered question is visible', () => {
    const nav = buildNav(chain, {
      marital_status: 'verheiratet',
      spouse_special_origin_rights: 'Spätaussiedler',
    })
    const answersRaw = [
      { question_id: 'q0', question_key: 'marital_status', group_instance: 'default' },
      {
        question_id: 'q1',
        question_key: 'spouse_special_origin_rights',
        group_instance: 'default',
      },
    ]
    expect(findStaleAnswerRefs(nav.flatVisible, answersRaw)).toHaveLength(0)
  })
})
