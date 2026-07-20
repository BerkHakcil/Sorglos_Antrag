/**
 * Document-rule evaluator (M5) — pure, no I/O, deliberately separate from the
 * questionnaire's VisibilityRule engine (different semantics: rules evaluate a
 * COMPLETED case's answers; there is no transitive visibility because the
 * stale-answer sweep guarantees hidden questions have no answers).
 *
 * Conditions come verbatim from the Pankow rules master (condition_json):
 *   {"always": true}
 *   {"field": k, "operator": "equals" | "not_equals", "value": v}
 *   {"any": [cond, ...]}  {"all": [cond, ...]}
 *   {"repeat_for_each": binding, "period_months"?: n}   — slot multiplier
 * A repeat_for_each may appear nested inside an "all" (e.g. marital gate +
 * spouse bank binding); it contributes slots only when the surrounding
 * conditions hold.
 */

export type RuleCondition = Record<string, unknown>

export type OfficeDocumentRule = {
  id: string // PAN-###
  document_id: string // DOC-####
  requirement_type: 'mandatory' | 'conditional'
  subject: 'person_1' | 'person_2' | 'previous_home'
  period_months: number | null
  condition: RuleCondition
}

export type CatalogDoc = {
  id: string // DOC-####
  name_de: string
  category: string
}

/** One concrete upload slot shown in the checklist. */
export type DocumentSlot = {
  ruleId: string
  documentId: string
  nameDe: string
  subject: 'person_1' | 'person_2' | 'previous_home'
  /** 'default' for single slots; group instanceId or composite key for repeats */
  instanceKey: string
  /** Extra label for repeated slots, e.g. "Girokonto" or "Rente 2" (built by caller) */
  instanceLabel: string | null
  periodMonths: number | null
}

export type EvalInput = {
  answers: Record<string, unknown>
  /** groupKey -> ordered instanceIds (as stored) */
  groupInstances: Record<string, string[]>
  /** instanceId -> { questionKey -> value } */
  groupAnswers: Record<string, Record<string, unknown>>
}

// ── Condition evaluation ──────────────────────────────────────────────────────

function leafHolds(cond: RuleCondition, answers: Record<string, unknown>): boolean {
  const field = cond.field as string
  const value = cond.value
  const answer = answers[field]
  if (cond.operator === 'equals') return answer === value
  if (cond.operator === 'not_equals')
    return answer !== undefined && answer !== null && answer !== value
  return false
}

/** Evaluates a condition ignoring any repeat_for_each nodes (those multiply slots, they don't gate). */
export function conditionHolds(cond: RuleCondition, answers: Record<string, unknown>): boolean {
  if (!cond || cond.always === true) return true
  if ('repeat_for_each' in cond) return true
  if (Array.isArray(cond.any))
    return (cond.any as RuleCondition[]).some((c) => conditionHolds(c, answers))
  if (Array.isArray(cond.all))
    return (cond.all as RuleCondition[]).every((c) => conditionHolds(c, answers))
  if ('field' in cond) return leafHolds(cond, answers)
  return false
}

/** Finds the repeat_for_each binding anywhere in the condition tree (or null). */
export function repeatBinding(cond: RuleCondition): string | null {
  if (!cond) return null
  if (typeof cond.repeat_for_each === 'string') return cond.repeat_for_each
  for (const k of ['any', 'all'] as const) {
    if (Array.isArray(cond[k])) {
      for (const c of cond[k] as RuleCondition[]) {
        const b = repeatBinding(c)
        if (b) return b
      }
    }
  }
  return null
}

// ── repeat_for_each bindings ──────────────────────────────────────────────────

type Instance = { key: string; label: string | null }

/** Bank slots = giro (always) + savings (if yes) + one per additional-account instance. */
function bankInstances(prefix: '' | 'spouse_', input: EvalInput): Instance[] {
  const out: Instance[] = [{ key: `${prefix}giro`, label: 'Girokonto' }]
  if (input.answers[`${prefix}bank_savings_account_yes_no`] === 'Ja')
    out.push({ key: `${prefix}savings`, label: 'Sparkonto' })
  const groupKey = `${prefix}bank_additional`
  for (const inst of input.groupInstances[groupKey] ?? []) {
    const a = input.groupAnswers[inst] ?? {}
    // Only instances the user actually filled produce a slot.
    if (Object.values(a).some((v) => v !== undefined && v !== null && v !== '')) {
      const name = a[`${prefix}bank_additional_name`]
      out.push({ key: inst, label: typeof name === 'string' && name ? name : 'Weiteres Konto' })
    }
  }
  return out
}

/** Group-based slots; skipEmpty drops unfilled placeholder instances, skipValues drops e.g. "Keine Rente". */
function groupBased(
  groupKey: string,
  labelField: string,
  labelPrefix: string,
  input: EvalInput,
  skipValues: string[] = []
): Instance[] {
  const out: Instance[] = []
  let n = 0
  for (const inst of input.groupInstances[groupKey] ?? []) {
    const a = input.groupAnswers[inst] ?? {}
    const filled = Object.values(a).some((v) => v !== undefined && v !== null && v !== '')
    if (!filled) continue
    const lv = a[labelField]
    if (typeof lv === 'string' && skipValues.includes(lv)) continue
    n++
    out.push({
      key: inst,
      label: typeof lv === 'string' && lv ? `${labelPrefix} ${n}: ${lv}` : `${labelPrefix} ${n}`,
    })
  }
  return out
}

export function instancesForBinding(binding: string, input: EvalInput): Instance[] {
  // Binding names come verbatim from the Pankow master's repeat_for_each values.
  switch (binding) {
    case 'applicant_bank_account':
      return bankInstances('', input)
    case 'spouse_bank_account':
      return bankInstances('spouse_', input)
    case 'pension_type':
      return groupBased('pension', 'pension_type', 'Rente', input, ['Keine Rente'])
    case 'spouse_pension_type':
      return groupBased('spouse_pension', 'spouse_pension_type', 'Rente', input, ['Keine Rente'])
    case 'other_income':
      return groupBased('other_income', 'other_income_type', 'Einkommen', input)
    case 'spouse_other_income':
      return groupBased('spouse_other_income', 'spouse_other_income_type', 'Einkommen', input)
    default:
      return [] // unknown binding → no slots (fail closed; seed-time validation guards this)
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function evaluateDocumentRules(
  rules: OfficeDocumentRule[],
  catalog: Record<string, CatalogDoc>,
  input: EvalInput
): DocumentSlot[] {
  const slots: DocumentSlot[] = []
  for (const rule of rules) {
    if (!conditionHolds(rule.condition, input.answers)) continue
    const doc = catalog[rule.document_id]
    const nameDe = doc?.name_de ?? rule.document_id
    const binding = repeatBinding(rule.condition)
    if (!binding) {
      slots.push({
        ruleId: rule.id,
        documentId: rule.document_id,
        nameDe,
        subject: rule.subject,
        instanceKey: 'default',
        instanceLabel: null,
        periodMonths: rule.period_months,
      })
      continue
    }
    for (const inst of instancesForBinding(binding, input)) {
      slots.push({
        ruleId: rule.id,
        documentId: rule.document_id,
        nameDe,
        subject: rule.subject,
        instanceKey: inst.key,
        instanceLabel: inst.label,
        periodMonths: rule.period_months,
      })
    }
  }
  return slots
}
