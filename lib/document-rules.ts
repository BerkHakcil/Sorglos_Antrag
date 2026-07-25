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
  // E1 (Essen rules): multi-select bulk answers are arrays of option values.
  // Absent/non-array answers never match (fail closed, like every operator).
  if (cond.operator === 'includes') return Array.isArray(answer) && answer.includes(value)
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
  return findRepeatNode(cond)?.binding ?? null
}

export type RepeatNode = {
  binding: string
  /** E2: only instances whose labeled member value is in this list emit a slot. */
  matchValues?: string[]
  /** E3: true when the binding node sits inside an `any` — the flat branches
   *  are then ALTERNATIVES that can contribute a single default slot. */
  viaAny: boolean
}

/** Locates the repeat_for_each node + its E2/E3 context. */
export function findRepeatNode(cond: RuleCondition, viaAny = false): RepeatNode | null {
  if (!cond) return null
  if (typeof cond.repeat_for_each === 'string') {
    return {
      binding: cond.repeat_for_each,
      matchValues: Array.isArray(cond.match_values) ? (cond.match_values as string[]) : undefined,
      viaAny,
    }
  }
  for (const k of ['any', 'all'] as const) {
    if (Array.isArray(cond[k])) {
      for (const c of cond[k] as RuleCondition[]) {
        const n = findRepeatNode(c, viaAny || k === 'any')
        if (n) return n
      }
    }
  }
  return null
}

/**
 * E3: evaluates the condition tree with every repeat_for_each branch treated
 * as FALSE — i.e. "does a flat (non-instance) branch hold on its own?".
 * Used only for bindings inside `any`: when zero instances match, a holding
 * flat branch contributes exactly one default slot.
 */
export function flatBranchHolds(cond: RuleCondition, answers: Record<string, unknown>): boolean {
  if (!cond || cond.always === true) return true
  if ('repeat_for_each' in cond) return false
  if (Array.isArray(cond.any))
    return (cond.any as RuleCondition[]).some((c) => flatBranchHolds(c, answers))
  if (Array.isArray(cond.all))
    return (cond.all as RuleCondition[]).every((c) => flatBranchHolds(c, answers))
  if ('field' in cond) return leafHolds(cond, answers)
  return false
}

// ── repeat_for_each bindings ──────────────────────────────────────────────────

type Instance = { key: string; label: string | null }

/** Bank slots = giro + savings (if yes) + one per additional-account instance.
 *  E4: the giro slot is suppressed when `${prefix}bank_giro_yes_no` is answered
 *  "Nein" — that gate question exists only in Essen, so Berlin/Pankow cases
 *  (where the key is never answered) keep the unconditional giro slot. */
function bankInstances(prefix: '' | 'spouse_', input: EvalInput): Instance[] {
  const out: Instance[] = []
  if (input.answers[`${prefix}bank_giro_yes_no`] !== 'Nein')
    out.push({ key: `${prefix}giro`, label: 'Girokonto' })
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

/** Group-based slots; skipEmpty drops unfilled placeholder instances, skipValues
 *  drops e.g. "Keine Rente", keepValues (E2: match_values) keeps ONLY instances
 *  whose labeled member value is listed. */
function groupBased(
  groupKey: string,
  labelField: string,
  labelPrefix: string,
  input: EvalInput,
  skipValues: string[] = [],
  keepValues?: string[]
): Instance[] {
  const out: Instance[] = []
  let n = 0
  for (const inst of input.groupInstances[groupKey] ?? []) {
    const a = input.groupAnswers[inst] ?? {}
    const filled = Object.values(a).some((v) => v !== undefined && v !== null && v !== '')
    if (!filled) continue
    const lv = a[labelField]
    if (typeof lv === 'string' && skipValues.includes(lv)) continue
    if (keepValues && !(typeof lv === 'string' && keepValues.includes(lv))) continue
    n++
    out.push({
      key: inst,
      label: typeof lv === 'string' && lv ? `${labelPrefix} ${n}: ${lv}` : `${labelPrefix} ${n}`,
    })
  }
  return out
}

export function instancesForBinding(
  binding: string,
  input: EvalInput,
  matchValues?: string[]
): Instance[] {
  // Binding names come verbatim from the office masters' repeat_for_each values.
  // matchValues (E2) applies to the group-based bindings; the composite bank
  // bindings ignore it (no labeled member to filter on).
  switch (binding) {
    case 'applicant_bank_account':
      return bankInstances('', input)
    case 'spouse_bank_account':
      return bankInstances('spouse_', input)
    case 'pension_type':
      return groupBased('pension', 'pension_type', 'Rente', input, ['Keine Rente'], matchValues)
    case 'spouse_pension_type':
      return groupBased(
        'spouse_pension',
        'spouse_pension_type',
        'Rente',
        input,
        ['Keine Rente'],
        matchValues
      )
    case 'other_income':
      return groupBased('other_income', 'other_income_type', 'Einkommen', input, [], matchValues)
    case 'spouse_other_income':
      return groupBased(
        'spouse_other_income',
        'spouse_other_income_type',
        'Einkommen',
        input,
        [],
        matchValues
      )
    default:
      return [] // unknown binding → no slots (fail closed; seed-time validation guards this)
  }
}

// ── Missing-documents counter (M6) ────────────────────────────────────────────

/** The (rule_id, instance_key) pair is the same join key the checklist UI uses
 *  to attach uploads to slots — kept structural so callers can pass DB rows. */
export type UploadRef = { rule_id: string; instance_key: string }

/** Count of required slots with zero uploads. Every evaluated slot is required
 *  by construction (conditional rules only emit slots when triggered). */
export function countMissingSlots(slots: DocumentSlot[], uploads: UploadRef[]): number {
  return slots.filter(
    (s) => !uploads.some((u) => u.rule_id === s.ruleId && u.instance_key === s.instanceKey)
  ).length
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
    const node = findRepeatNode(rule.condition)
    if (!node) {
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
    const instances = instancesForBinding(node.binding, input, node.matchValues)
    for (const inst of instances) {
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
    // E3 (chosen semantic, ESS-015/016): a binding inside `any` makes the flat
    // branches ALTERNATIVES — when zero instances match, a holding flat branch
    // contributes exactly ONE default slot; when instances match, only the
    // per-entry slots are emitted. Bindings inside `all` (the Pankow shape)
    // never reach this: viaAny is false there.
    if (instances.length === 0 && node.viaAny && flatBranchHolds(rule.condition, input.answers)) {
      slots.push({
        ruleId: rule.id,
        documentId: rule.document_id,
        nameDe,
        subject: rule.subject,
        instanceKey: 'default',
        instanceLabel: null,
        periodMonths: rule.period_months,
      })
    }
  }
  return slots
}
