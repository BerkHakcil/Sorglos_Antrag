import { describe, it, expect } from 'vitest'
import { deriveGroupData, capInstances, parseCount } from '@/lib/group-instances'
import { buildNav } from '@/lib/questionnaire-nav'
import {
  evaluateDocumentRules,
  type OfficeDocumentRule,
  type CatalogDoc,
} from '@/lib/document-rules'
import type { LoadedQuestionnaire, Question } from '@/lib/questionnaire-types'

/**
 * Pass 4 / D15 — count-driven repeatable groups. The synthetic questionnaire
 * mirrors the live Berlin shape after migration 20260801000003: a required
 * `pension_count` (options "0".."8") driving a 4-member `pension` group whose
 * members are unconditionally required within an instance.
 */

function q(overrides: Partial<Question>): Question {
  return {
    id: 'q',
    key: 'q',
    sort_order: 0,
    answer_type: 'short_text',
    is_required: true,
    prompt_de: '?',
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
    group_count_source_key: null,
    options: [],
    ...overrides,
  }
}

const pensionMember = (id: string, key: string, so: number): Question =>
  q({
    id,
    key,
    sort_order: so,
    group_id: 'grp-pension',
    group_key: 'pension',
    group_label_de: 'Rente / Pension',
    group_is_repeatable: true,
    group_count_source_key: 'pension_count',
  })

const QN: LoadedQuestionnaire = {
  id: 'qn',
  name: 'Test',
  categories: [
    {
      id: 'cat-income',
      key: 'income',
      sort_order: 0,
      label_de: 'Einkünfte',
      questions: [
        q({
          id: 'q-count',
          key: 'pension_count',
          sort_order: 0,
          answer_type: 'single_select',
          options: Array.from({ length: 9 }, (_, i) => ({
            id: `o${i}`,
            key: `pension_count_${i}`,
            sort_order: i,
            label_de: String(i),
            value: String(i),
          })),
        }),
        pensionMember('q-type', 'pension_type', 1),
        pensionMember('q-amount', 'pension_amount', 2),
        pensionMember('q-id', 'pension_id', 3),
        pensionMember('q-issuer', 'pension_issuer', 4),
        // a CLASSIC repeatable group rides along to prove non-count behavior
        q({
          id: 'q-oi-type',
          key: 'other_income_type',
          sort_order: 5,
          group_id: 'grp-oi',
          group_key: 'other_income',
          group_label_de: 'Einkommen',
          group_is_repeatable: true,
        }),
      ],
    },
  ],
}

const row = (question_id: string, group_instance: string, value: unknown) => ({
  question_id,
  group_instance,
  value,
})

describe('parseCount / capInstances', () => {
  it('parses the stored select strings and fails closed on anything else', () => {
    expect(parseCount('0')).toBe(0)
    expect(parseCount('8')).toBe(8)
    expect(parseCount('')).toBe(0)
    expect(parseCount(undefined)).toBe(0)
    expect(parseCount(null)).toBe(0)
    expect(parseCount('quatsch')).toBe(0)
    expect(parseCount('-3')).toBe(0)
  })

  it('capInstances truncates from the end and extends with fresh ids', () => {
    let n = 0
    const make = () => `new-${n++}`
    expect(capInstances(['a', 'b', 'c'], 2, make)).toEqual(['a', 'b'])
    expect(capInstances(['a'], 3, make)).toEqual(['a', 'new-0', 'new-1'])
    expect(capInstances([], 0, make)).toEqual([])
  })
})

describe('deriveGroupData — count-driven group (D15)', () => {
  it('count unanswered → ZERO instances in every mode (no placeholder)', () => {
    for (const mode of ['render', 'completion', 'export'] as const) {
      const { groupInstances } = deriveGroupData(QN, [], mode)
      expect(groupInstances['pension']).toEqual([])
    }
  })

  it("count '3' with no stored instances → exactly 3 fresh instances", () => {
    const { groupInstances } = deriveGroupData(QN, [row('q-count', 'default', '3')], 'render')
    expect(groupInstances['pension']).toHaveLength(3)
    expect(new Set(groupInstances['pension']).size).toBe(3)
  })

  it("count '2' with 3 stored instances → the two OLDEST survive, in order", () => {
    const rows = [
      row('q-count', 'default', '2'),
      row('q-type', 'inst-1', 'Altersrente'),
      row('q-type', 'inst-2', 'Unfallrente'),
      row('q-type', 'inst-3', 'Werksrente'),
    ]
    const { groupInstances } = deriveGroupData(QN, rows, 'render')
    expect(groupInstances['pension']).toEqual(['inst-1', 'inst-2'])
  })

  it("count '3' with 2 stored instances → both kept + one fresh appended", () => {
    const rows = [
      row('q-count', 'default', '3'),
      row('q-type', 'inst-1', 'Altersrente'),
      row('q-type', 'inst-2', 'Unfallrente'),
    ]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'render')
    expect(groupInstances['pension'].slice(0, 2)).toEqual(['inst-1', 'inst-2'])
    expect(groupInstances['pension']).toHaveLength(3)
    expect(groupAnswers['inst-1']).toEqual({ pension_type: 'Altersrente' })
  })

  it('classic group keeps its per-mode behavior (regression)', () => {
    const render = deriveGroupData(QN, [], 'render')
    expect(render.groupInstances['other_income']).toHaveLength(1)
    const completion = deriveGroupData(QN, [], 'completion')
    expect(completion.groupInstances['other_income']).toEqual([
      '00000000-0000-0000-0000-000000000000',
    ])
    const exp = deriveGroupData(QN, [], 'export')
    expect(exp.groupInstances['other_income']).toEqual([])
  })
})

describe('buildNav with a count-driven group', () => {
  it('count 0: group contributes nothing; everything else answered → complete', () => {
    const { groupInstances, groupAnswers } = deriveGroupData(
      QN,
      [row('q-count', 'default', '0'), row('q-oi-type', 'oi-1', 'Miete')],
      'render'
    )
    const nav = buildNav(QN, { pension_count: '0' }, groupInstances, groupAnswers)
    expect(nav.flatVisible.filter((x) => x.group_key === 'pension')).toHaveLength(0)
    expect(nav.allRequiredAnswered).toBe(true)
  })

  it('count 3: exactly 3 × 4 member questions in the denominator', () => {
    const { groupInstances, groupAnswers } = deriveGroupData(
      QN,
      [row('q-count', 'default', '3'), row('q-oi-type', 'oi-1', 'Miete')],
      'render'
    )
    const nav = buildNav(QN, { pension_count: '3' }, groupInstances, groupAnswers)
    expect(nav.flatVisible.filter((x) => x.group_key === 'pension')).toHaveLength(12)
    // pension_count + 12 members + 1 classic-group member
    expect(nav.totalRequired).toBe(14)
  })

  it('an unanswered Abrechnungsnummer (pension_id) BLOCKS completion', () => {
    const rows = [
      row('q-count', 'default', '1'),
      row('q-oi-type', 'oi-1', 'Miete'),
      row('q-type', 'inst-1', 'Altersrente'),
      row('q-amount', 'inst-1', 800),
      // pension_id deliberately missing
      row('q-issuer', 'inst-1', 'DRV'),
    ]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'completion')
    const nav = buildNav(QN, { pension_count: '1' }, groupInstances, groupAnswers)
    expect(nav.allRequiredAnswered).toBe(false)
    expect(nav.resumeQuestion?.key).toBe('pension_id')
  })

  it('NEVER shows the add-another prompt for a count-driven group', () => {
    const rows = [
      row('q-count', 'default', '1'),
      row('q-oi-type', 'oi-1', 'Miete'),
      row('q-type', 'inst-1', 'Altersrente'),
      row('q-amount', 'inst-1', 800),
      row('q-id', 'inst-1', 'R1'),
      row('q-issuer', 'inst-1', 'DRV'),
    ]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'render')
    const nav = buildNav(QN, { pension_count: '1' }, groupInstances, groupAnswers)
    // the pension instance is complete — a classic group would prompt here
    expect(nav.groupPrompt?.groupKey).not.toBe('pension')
  })

  it('classic group still prompts when complete (regression)', () => {
    const rows = [row('q-count', 'default', '0'), row('q-oi-type', 'oi-1', 'Miete')]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'render')
    const nav = buildNav(QN, { pension_count: '0' }, groupInstances, groupAnswers)
    expect(nav.groupPrompt?.groupKey).toBe('other_income')
  })
})

describe('document slots follow the capped derivation (PAN-003 shape)', () => {
  const rule: OfficeDocumentRule = {
    id: 'PAN-003',
    document_id: 'DOC-0002',
    requirement_type: 'mandatory',
    subject: 'person_1',
    period_months: null,
    condition: { repeat_for_each: 'pension_type' },
  }
  const catalog: Record<string, CatalogDoc> = {
    'DOC-0002': { id: 'DOC-0002', name_de: 'Renten/Pensionsbescheid', category: 'income' },
  }

  it('3 filled instances capped to count 2 → exactly 2 slots, oldest first', () => {
    const rows = [
      row('q-count', 'default', '2'),
      row('q-type', 'inst-1', 'Altersrente'),
      row('q-type', 'inst-2', 'Unfallrente'),
      row('q-type', 'inst-3', 'Werksrente'),
    ]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'export')
    const slots = evaluateDocumentRules([rule], catalog, {
      answers: { pension_count: '2' },
      groupInstances,
      groupAnswers,
    })
    expect(slots).toHaveLength(2)
    expect(slots.map((s) => s.instanceLabel)).toEqual([
      'Rente 1: Altersrente',
      'Rente 2: Unfallrente',
    ])
  })

  it('count 0 → NO pension slots even with stored instance data (the locked Keine-Rente case)', () => {
    const rows = [row('q-count', 'default', '0'), row('q-type', 'inst-1', 'Keine Rente')]
    const { groupInstances, groupAnswers } = deriveGroupData(QN, rows, 'export')
    const slots = evaluateDocumentRules([rule], catalog, {
      answers: { pension_count: '0' },
      groupInstances,
      groupAnswers,
    })
    expect(slots).toHaveLength(0)
  })
})
