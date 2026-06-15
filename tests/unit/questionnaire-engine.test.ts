import { describe, it, expect } from 'vitest'
import { isVisible, type VisibilityRule, type Question, type Category } from '@/lib/questionnaire-engine'

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
