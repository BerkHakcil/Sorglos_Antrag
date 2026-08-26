/**
 * Fallback document list — Line-A purge gate (fallback-docs fix, 2026-08-26).
 *
 * The purged default list = Pankow's ACTIVE rules minus exactly the ids in
 * tests/fixtures/fallback-excluded-ids.json (the founder-approved Line-A
 * trio). Three layers of proof, gate-style like the Pankow regression:
 *
 *  1. Lockstep — the fixture, the migration SQL, and the Phase-1
 *     classification (mandatory / person_1 / always) agree on the ids.
 *  2. Subtraction golden — the purged list evaluated over the existing
 *     F1/F2/F3 answer fixtures is byte-identical to the committed
 *     default-golden-slots.json AND provably equals the Pankow golden minus
 *     exactly the excluded rules' slots: the purge is a strict subset, no
 *     Pankow slot is otherwise touched.
 *  3. Hide-but-retain — an upload against a dropped rule emits no slot,
 *     never reduces the missing count, and classifyUploads flags it
 *     not_required for the case export.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  evaluateDocumentRules,
  countMissingSlots,
  classifyUploads,
  type DocumentSlot,
  type OfficeDocumentRule,
  type EvalInput,
} from '@/lib/document-rules'
import { resolveEffectiveRules } from '@/lib/rules-source'
import { F1, F2, F3 } from '../fixtures/pankow-answer-fixtures.mjs'

const fixturesDir = join(__dirname, '..', 'fixtures')
const pankowSnap = JSON.parse(
  readFileSync(join(fixturesDir, 'pankow-rules.snapshot.json'), 'utf-8')
)
const pankowGolden = JSON.parse(
  readFileSync(join(fixturesDir, 'pankow-golden-slots.json'), 'utf-8')
)
const defaultGolden = JSON.parse(
  readFileSync(join(fixturesDir, 'default-golden-slots.json'), 'utf-8')
)
const EXCLUDED: string[] = JSON.parse(
  readFileSync(join(fixturesDir, 'fallback-excluded-ids.json'), 'utf-8')
)
const MIGRATION = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    'supabase',
    'migrations',
    '20260826000001_fallback_excluded_rule_ids.sql'
  ),
  'utf-8'
)

const pankowCatalog = Object.fromEntries(
  (pankowSnap.catalog as { id: string }[]).map((c) => [c.id, c])
)
const activeRules = (pankowSnap.rules as (OfficeDocumentRule & { active?: boolean })[]).filter(
  (r) => r.active !== false
)

/** The served fallback set, derived through the real ladder decision. */
function purgedRules() {
  return resolveEffectiveRules({
    socialOfficeId: null,
    ownRules: [],
    defaultOfficeId: 'default-office',
    defaultRules: activeRules,
    excludedRuleIds: EXCLUDED,
  }).rules
}

// ── 1. Lockstep ───────────────────────────────────────────────────────────────

describe('Line-A exclusion ids — fixture/migration/classification lockstep', () => {
  it('the fixture is exactly the approved trio', () => {
    expect(EXCLUDED).toEqual(['PAN-016', 'PAN-017', 'PAN-018'])
  })

  it('every JSON id array in the migration equals the fixture (seed + both guard blocks)', () => {
    const arrays = MIGRATION.match(/\[[^\]]*"PAN-[^\]]*\]/g) ?? []
    expect(arrays.length).toBeGreaterThan(0)
    for (const a of arrays) expect(JSON.parse(a)).toEqual(EXCLUDED)
  })

  it('every excluded id is an ACTIVE always-fire person_1 mandatory in the snapshot (typo guard + Phase-1 classification)', () => {
    for (const id of EXCLUDED) {
      const r = (pankowSnap.rules as (OfficeDocumentRule & { active?: boolean })[]).find(
        (x) => x.id === id
      )
      expect(r, `${id} missing from the Pankow snapshot`).toBeDefined()
      expect(r!.active !== false, `${id} is inactive`).toBe(true)
      expect(r!.requirement_type).toBe('mandatory')
      expect(r!.subject).toBe('person_1')
      expect(r!.condition).toEqual({ always: true })
    }
  })
})

// ── 2. Subtraction golden ─────────────────────────────────────────────────────

describe('purged default list — subtraction golden (gate style)', () => {
  const fixtures = { F1, F2, F3 } as Record<string, EvalInput>

  for (const name of ['F1', 'F2', 'F3']) {
    it(`${name}: byte-identical to the committed default golden`, () => {
      const now = evaluateDocumentRules(purgedRules(), pankowCatalog as never, fixtures[name])
      expect(JSON.stringify(now)).toBe(JSON.stringify(defaultGolden[name]))
    })

    it(`${name}: equals the Pankow golden minus exactly the excluded rules' slots (and inactive PAN-011)`, () => {
      const now = evaluateDocumentRules(purgedRules(), pankowCatalog as never, fixtures[name])
      const expected = (pankowGolden[name] as DocumentSlot[]).filter(
        (s) => s.ruleId !== 'PAN-011' && !EXCLUDED.includes(s.ruleId)
      )
      expect(JSON.stringify(now)).toBe(JSON.stringify(expected))
    })
  }

  it('fresh fallback list drops 11 → 8 slots (F2, minimal single applicant)', () => {
    const fresh = (pankowGolden.F2 as DocumentSlot[]).filter((s) => s.ruleId !== 'PAN-011')
    expect(fresh.length).toBe(11)
    expect((defaultGolden.F2 as DocumentSlot[]).length).toBe(8)
  })

  it('the purge is a strict rule subset — no rule outside the exclusion list is touched', () => {
    const purgedIds = new Set(purgedRules().map((r) => r.id))
    for (const r of activeRules) {
      expect(purgedIds.has(r.id)).toBe(!EXCLUDED.includes(r.id))
    }
  })
})

// ── 3. Hide-but-retain ────────────────────────────────────────────────────────

describe('hide-but-retain — uploads against dropped requirements', () => {
  const slots = () => evaluateDocumentRules(purgedRules(), pankowCatalog as never, F2)

  it('no slot is emitted for a dropped rule', () => {
    expect(slots().some((s) => EXCLUDED.includes(s.ruleId))).toBe(false)
  })

  it('a dropped-rule upload neither renders nor counts; a kept-slot upload still counts', () => {
    const s = slots()
    const uploads = [
      { rule_id: 'PAN-016', instance_key: 'default' }, // dropped — must be inert
      { rule_id: 'PAN-001', instance_key: 'default' }, // kept — fills one slot
    ]
    expect(countMissingSlots(s, uploads)).toBe(s.length - 1)
    const { matched, notRequired } = classifyUploads(s, uploads)
    expect(notRequired.map((u) => u.rule_id)).toEqual(['PAN-016'])
    expect(matched.map((u) => u.rule_id)).toEqual(['PAN-001'])
  })

  it('a complete case stays complete: every kept slot filled + trio uploads → missing 0, trio flagged not_required (the 52e364f1 shape)', () => {
    const s = slots()
    const uploads = [
      ...s.map((x) => ({ rule_id: x.ruleId, instance_key: x.instanceKey })),
      ...EXCLUDED.map((id) => ({ rule_id: id, instance_key: 'default' })),
    ]
    expect(countMissingSlots(s, uploads)).toBe(0)
    expect(classifyUploads(s, uploads).notRequired.map((u) => u.rule_id)).toEqual(EXCLUDED)
  })
})

describe('classifyUploads — partition semantics', () => {
  const slot = (ruleId: string, instanceKey: string): DocumentSlot => ({
    ruleId,
    documentId: 'DOC-0001',
    nameDe: 'Personaldokument',
    subject: 'person_1',
    instanceKey,
    instanceLabel: null,
    periodMonths: null,
  })

  it('matches per (rule_id, instance_key) — a right-rule wrong-instance upload is not_required', () => {
    const { matched, notRequired } = classifyUploads(
      [slot('PAN-003', 'i1')],
      [
        { rule_id: 'PAN-003', instance_key: 'i1' },
        { rule_id: 'PAN-003', instance_key: 'i2' },
      ]
    )
    expect(matched.map((u) => u.instance_key)).toEqual(['i1'])
    expect(notRequired.map((u) => u.instance_key)).toEqual(['i2'])
  })

  it('zero slots → every upload not_required; zero uploads → both empty', () => {
    const one = classifyUploads([], [{ rule_id: 'PAN-001', instance_key: 'default' }])
    expect(one.matched).toEqual([])
    expect(one.notRequired.length).toBe(1)
    const none = classifyUploads([slot('PAN-001', 'default')], [])
    expect(none.matched).toEqual([])
    expect(none.notRequired).toEqual([])
  })
})
