/**
 * PAN-025 — Pankow/default widowed applicants get the Sterbeurkunde-Partner
 * slot (widowed pass, GATE 1 2026-08-29: coverage-only Phase 2).
 *
 * The rule itself has been live since M5R2 (migration 20260711000006) and is
 * live-proven (three widowed prod cases carry the slot; two uploaded against
 * it — docs/feedback/widowed_doc_phase1.md). What was MISSING was the
 * Pankow-side guard: only Essen's twin ESS-056 had direct unit coverage.
 * This file closes that gap, mirroring the ESS-056 test shape
 * (essen-document-rules.test.ts) against the committed Pankow snapshot:
 *
 *  1. Snapshot lockstep — PAN-025/DOC-0016 exist in the snapshot exactly as
 *     Phase 1 surveyed them (conditional, person_1, equals 'verwitwet').
 *  2. Fire/fail-closed — F4 (widowed) emits exactly ONE slot; F1–F3 and the
 *     unanswered case emit none.
 *  3. Universality via fallback — the PURGED default list (the real ladder
 *     decision minus the Line-A exclusions) still serves PAN-025, so
 *     fallback-served widowed cases get the slot. This is also the
 *     governance tripwire: PAN-025 must never join
 *     fallback_excluded_rule_ids (lib/rules-source.ts standing rule).
 *  4. Isolation — removing PAN-025 changes nothing else (ESS-056 pattern).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  evaluateDocumentRules,
  type DocumentSlot,
  type OfficeDocumentRule,
  type EvalInput,
} from '@/lib/document-rules'
import { resolveEffectiveRules } from '@/lib/rules-source'
import { F1, F2, F3, F4 } from '../fixtures/pankow-answer-fixtures.mjs'

const fixturesDir = join(__dirname, '..', 'fixtures')
const pankowSnap = JSON.parse(
  readFileSync(join(fixturesDir, 'pankow-rules.snapshot.json'), 'utf-8')
)
const EXCLUDED: string[] = JSON.parse(
  readFileSync(join(fixturesDir, 'fallback-excluded-ids.json'), 'utf-8')
)

const pankowCatalog = Object.fromEntries(
  (pankowSnap.catalog as { id: string }[]).map((c) => [c.id, c])
)
const activeRules = (pankowSnap.rules as (OfficeDocumentRule & { active?: boolean })[]).filter(
  (r) => r.active !== false
)

function evalPankow(rules: OfficeDocumentRule[], input: EvalInput): DocumentSlot[] {
  return evaluateDocumentRules(rules, pankowCatalog as never, input)
}
const ofRule = (slots: DocumentSlot[], id: string) => slots.filter((s) => s.ruleId === id)
const EMPTY: EvalInput = { answers: {}, groupInstances: {}, groupAnswers: {} }

// ── 1. Snapshot lockstep ──────────────────────────────────────────────────────

describe('PAN-025 snapshot lockstep — the rule as Phase 1 surveyed it', () => {
  it('PAN-025 is an ACTIVE conditional person_1 rule on marital_status equals verwitwet', () => {
    const r = (pankowSnap.rules as (OfficeDocumentRule & { active?: boolean })[]).find(
      (x) => x.id === 'PAN-025'
    )
    expect(r, 'PAN-025 missing from the Pankow snapshot').toBeDefined()
    expect(r!.active !== false).toBe(true)
    expect(r!.requirement_type).toBe('conditional')
    expect(r!.subject).toBe('person_1')
    expect(r!.document_id).toBe('DOC-0016')
    expect(r!.period_months).toBeNull()
    expect(r!.condition).toEqual({
      field: 'marital_status',
      operator: 'equals',
      value: 'verwitwet',
    })
  })

  it('DOC-0016 is the active Sterbeurkunde-Partner catalog entry', () => {
    const d = (pankowSnap.catalog as { id: string; name_de: string; active?: boolean }[]).find(
      (x) => x.id === 'DOC-0016'
    )
    expect(d, 'DOC-0016 missing from the Pankow snapshot catalog').toBeDefined()
    expect(d!.name_de).toBe('Sterbeurkunde Partner')
    expect(d!.active !== false).toBe(true)
  })
})

// ── 2. Fire / fail-closed ─────────────────────────────────────────────────────

describe('PAN-025 — widowed fires exactly once, everything else fails closed', () => {
  it('F4 (widowed single applicant) gets exactly ONE Sterbeurkunde Partner slot', () => {
    const slots = ofRule(evalPankow(activeRules, F4 as EvalInput), 'PAN-025')
    expect(slots).toHaveLength(1)
    expect(slots[0].subject).toBe('person_1')
    expect(slots[0].nameDe).toBe('Sterbeurkunde Partner')
    expect(slots[0].instanceKey).toBe('default')
    expect(slots[0].periodMonths).toBeNull()
  })

  it('does not fire for F1 (married), F2 (ledig), F3 (getrennt lebend) or unanswered', () => {
    for (const fixture of [F1, F2, F3] as EvalInput[]) {
      expect(ofRule(evalPankow(activeRules, fixture), 'PAN-025')).toHaveLength(0)
    }
    expect(ofRule(evalPankow(activeRules, EMPTY), 'PAN-025')).toHaveLength(0)
  })
})

// ── 3. Universality via the fallback branch (governance tripwire) ─────────────

describe('PAN-025 on the fallback branch — the universality half of the rule', () => {
  const purged = resolveEffectiveRules({
    socialOfficeId: null,
    ownRules: [],
    defaultOfficeId: 'default-office',
    defaultRules: activeRules,
    excludedRuleIds: EXCLUDED,
  }).rules

  it('the Line-A exclusion fixture never contains PAN-025 (standing governance rule)', () => {
    expect(EXCLUDED).not.toContain('PAN-025')
  })

  it('the purged default list still serves PAN-025', () => {
    expect(purged.some((r) => r.id === 'PAN-025')).toBe(true)
  })

  it('a fallback-served widowed case gets the slot; a fallback ledig case does not (the live prod shapes)', () => {
    expect(ofRule(evalPankow(purged, F4 as EvalInput), 'PAN-025')).toHaveLength(1)
    expect(ofRule(evalPankow(purged, F2 as EvalInput), 'PAN-025')).toHaveLength(0)
  })
})

// ── 4. Isolation (ESS-056 pattern) ────────────────────────────────────────────

describe('PAN-025 isolation — removing it changes nothing else', () => {
  it('outputs minus PAN-025 are byte-identical to the without-rule evaluation', () => {
    const withoutRule = activeRules.filter((r) => r.id !== 'PAN-025')
    for (const fixture of [F1, F2, F3, F4, EMPTY] as EvalInput[]) {
      const before = evalPankow(withoutRule, fixture)
      const after = evalPankow(activeRules, fixture).filter((s) => s.ruleId !== 'PAN-025')
      expect(JSON.stringify(after)).toBe(JSON.stringify(before))
    }
  })
})
