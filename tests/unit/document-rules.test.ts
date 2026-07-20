import { describe, it, expect } from 'vitest'
import {
  conditionHolds,
  evaluateDocumentRules,
  type OfficeDocumentRule,
  type CatalogDoc,
  type EvalInput,
} from '@/lib/document-rules'

const MARITAL_ANY = {
  any: [
    { field: 'marital_status', operator: 'equals', value: 'verheiratet' },
    { field: 'marital_status', operator: 'equals', value: 'eingetragene Lebenspartnerschaft' },
    { field: 'marital_status', operator: 'equals', value: 'eheähnliche Gemeinschaft' },
  ],
}
const catalog: Record<string, CatalogDoc> = {
  'DOC-0001': { id: 'DOC-0001', name_de: 'Personaldokument', category: 'identity' },
  'DOC-0002': { id: 'DOC-0002', name_de: 'Rentenbescheid', category: 'income' },
  'DOC-0003': { id: 'DOC-0003', name_de: 'Kontoauszuege', category: 'wealth' },
}
const base: EvalInput = { answers: {}, groupInstances: {}, groupAnswers: {} }

describe('conditionHolds', () => {
  it('always', () => expect(conditionHolds({ always: true }, {})).toBe(true))
  it('equals', () => {
    expect(conditionHolds({ field: 'x', operator: 'equals', value: 'Ja' }, { x: 'Ja' })).toBe(true)
    expect(conditionHolds({ field: 'x', operator: 'equals', value: 'Ja' }, {})).toBe(false)
  })
  it('not_equals requires an answer (PAN-026 semantics: unanswered ≠ not-German)', () => {
    expect(
      conditionHolds({ field: 'x', operator: 'not_equals', value: 'deutsch' }, { x: 'polnisch' })
    ).toBe(true)
    expect(conditionHolds({ field: 'x', operator: 'not_equals', value: 'deutsch' }, {})).toBe(false)
  })
  it('any/all nesting (PAN-031 shape)', () => {
    const cond = { all: [MARITAL_ANY, { field: 'spouse_x', operator: 'equals', value: 'Ja' }] }
    expect(conditionHolds(cond, { marital_status: 'verheiratet', spouse_x: 'Ja' })).toBe(true)
    expect(conditionHolds(cond, { marital_status: 'ledig', spouse_x: 'Ja' })).toBe(false)
    expect(conditionHolds(cond, { marital_status: 'verheiratet', spouse_x: 'Nein' })).toBe(false)
  })
})

describe('evaluateDocumentRules — slots', () => {
  it('mandatory always -> one default slot', () => {
    const rules: OfficeDocumentRule[] = [
      {
        id: 'PAN-001',
        document_id: 'DOC-0001',
        requirement_type: 'mandatory',
        subject: 'person_1',
        period_months: null,
        condition: { always: true },
      },
    ]
    const slots = evaluateDocumentRules(rules, catalog, base)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({
      ruleId: 'PAN-001',
      instanceKey: 'default',
      nameDe: 'Personaldokument',
    })
  })

  it('pension repeat: two real pensions -> two slots; "Keine Rente" instance -> none', () => {
    const rules: OfficeDocumentRule[] = [
      {
        id: 'PAN-003',
        document_id: 'DOC-0002',
        requirement_type: 'conditional',
        subject: 'person_1',
        period_months: null,
        condition: { repeat_for_each: 'pension_type' },
      },
    ]
    const input: EvalInput = {
      answers: {},
      groupInstances: { pension: ['i1', 'i2', 'i3'] },
      groupAnswers: {
        i1: { pension_type: 'Altersrente', pension_amount: 1200 },
        i2: { pension_type: 'Witwenrente' },
        i3: { pension_type: 'Keine Rente' },
      },
    }
    const slots = evaluateDocumentRules(rules, catalog, input)
    expect(slots).toHaveLength(2)
    expect(slots.map((s) => s.instanceKey)).toEqual(['i1', 'i2'])
    expect(slots[0].instanceLabel).toContain('Altersrente')
  })

  it('bank composite: giro always, savings if Ja, one per filled additional instance', () => {
    const rules: OfficeDocumentRule[] = [
      {
        id: 'PAN-005',
        document_id: 'DOC-0003',
        requirement_type: 'mandatory',
        subject: 'person_1',
        period_months: 4,
        condition: { repeat_for_each: 'applicant_bank_account', period_months: 4 },
      },
    ]
    const input: EvalInput = {
      answers: { bank_savings_account_yes_no: 'Ja' },
      groupInstances: { bank_additional: ['a1', 'a2'] },
      groupAnswers: { a1: { bank_additional_name: 'Sparkasse' }, a2: {} }, // a2 = empty placeholder
    }
    const slots = evaluateDocumentRules(rules, catalog, input)
    expect(slots.map((s) => s.instanceKey)).toEqual(['giro', 'savings', 'a1'])
    expect(slots.every((s) => s.periodMonths === 4)).toBe(true)
  })

  it('spouse bank repeat inside marital all-gate only fires when married', () => {
    const cond = {
      all: [MARITAL_ANY, { repeat_for_each: 'spouse_bank_account', period_months: 4 }],
    }
    const rules: OfficeDocumentRule[] = [
      {
        id: 'PAN-006',
        document_id: 'DOC-0003',
        requirement_type: 'mandatory',
        subject: 'person_2',
        period_months: 4,
        condition: cond,
      },
    ]
    const married: EvalInput = {
      answers: { marital_status: 'verheiratet' },
      groupInstances: {},
      groupAnswers: {},
    }
    expect(evaluateDocumentRules(rules, catalog, married).map((s) => s.instanceKey)).toEqual([
      'spouse_giro',
    ])
    const single: EvalInput = {
      answers: { marital_status: 'ledig' },
      groupInstances: {},
      groupAnswers: {},
    }
    expect(evaluateDocumentRules(rules, catalog, single)).toHaveLength(0)
  })

  it('unknown binding fails closed', () => {
    const rules: OfficeDocumentRule[] = [
      {
        id: 'PAN-X',
        document_id: 'DOC-0003',
        requirement_type: 'mandatory',
        subject: 'person_1',
        period_months: null,
        condition: { repeat_for_each: 'nonsense' },
      },
    ]
    expect(evaluateDocumentRules(rules, catalog, base)).toHaveLength(0)
  })
})
