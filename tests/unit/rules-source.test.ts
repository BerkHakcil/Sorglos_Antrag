import { describe, it, expect } from 'vitest'
import {
  resolveEffectiveRules,
  parseDefaultOfficeId,
  parseExcludedRuleIds,
  DEFAULT_OFFICE_CONFIG_KEY,
  FALLBACK_EXCLUSIONS_CONFIG_KEY,
} from '@/lib/rules-source'

/**
 * Fallback-docs fix (2026-08-26) — the shared ladder decision. These tests
 * pin two contracts the deploy depends on:
 *
 *  1. Exclusions apply on the FALLBACK branch only — an office that owns
 *     rules is served them untouched (Pankow/Essen byte-identity).
 *  2. Every config failure mode fails OPEN to the pre-fix behavior — a
 *     missing or malformed exclusion row serves the full default set, which
 *     is what makes the code-before-migration deploy ordering benign
 *     (CLAUDE.md #8's row-add case). This is the executable proof the
 *     Phase-2 brief demanded, not an assertion.
 */

const R = (id: string) => ({ id })
const OWN = [R('ESS-001'), R('ESS-010')]
const DEFAULTS = [R('PAN-001'), R('PAN-005'), R('PAN-016'), R('PAN-017'), R('PAN-018')]
const TRIO = ['PAN-016', 'PAN-017', 'PAN-018']

describe('resolveEffectiveRules — ladder decision', () => {
  it('an office with active rules uses its own, unfiltered — exclusions never touch the own branch', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: 'essen',
      ownRules: OWN,
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      // Deliberately excluding an OWN id: it must still be served.
      excludedRuleIds: ['ESS-001', ...TRIO],
    })
    expect(r.rulesSource).toBe('own')
    // Same array reference, not a filtered copy — byte-identical own behavior.
    expect(r.rules).toBe(OWN)
  })

  it('rule-less office → default set minus exclusions, source fallback', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: 'stade',
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      excludedRuleIds: TRIO,
    })
    expect(r.rulesSource).toBe('fallback')
    expect(r.rules.map((x) => x.id)).toEqual(['PAN-001', 'PAN-005'])
  })

  it('office-less case (unsupported PLZ) → the same fallback', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: null,
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      excludedRuleIds: TRIO,
    })
    expect(r.rulesSource).toBe('fallback')
    expect(r.rules.map((x) => x.id)).toEqual(['PAN-001', 'PAN-005'])
  })

  it('the default office itself never gets its set as "fallback" (guard)', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: 'pankow',
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      excludedRuleIds: [],
    })
    expect(r.rulesSource).toBe('none')
    expect(r.rules).toEqual([])
  })

  it('no default configured / empty default set → none', () => {
    expect(
      resolveEffectiveRules({
        socialOfficeId: 'stade',
        ownRules: [],
        defaultOfficeId: null,
        defaultRules: DEFAULTS,
        excludedRuleIds: [],
      }).rulesSource
    ).toBe('none')
    expect(
      resolveEffectiveRules({
        socialOfficeId: 'stade',
        ownRules: [],
        defaultOfficeId: 'pankow',
        defaultRules: [],
        excludedRuleIds: [],
      }).rulesSource
    ).toBe('none')
  })

  it('exclusions emptying the default set → none (docsPaneMode safety branch)', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: null,
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: [R('PAN-016')],
      excludedRuleIds: TRIO,
    })
    expect(r.rulesSource).toBe('none')
    expect(r.rules).toEqual([])
  })

  it('empty exclusion list serves the FULL default set — identical to the pre-fix ladder', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: null,
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      excludedRuleIds: [],
    })
    expect(r.rulesSource).toBe('fallback')
    // Same array reference — no copy, no reorder, nothing filtered.
    expect(r.rules).toBe(DEFAULTS)
  })

  it('an unknown excluded id excludes nothing (fail-open; existence is asserted at push time)', () => {
    const r = resolveEffectiveRules({
      socialOfficeId: null,
      ownRules: [],
      defaultOfficeId: 'pankow',
      defaultRules: DEFAULTS,
      excludedRuleIds: ['PAN-016', 'PAN-999'],
    })
    expect(r.rules.map((x) => x.id)).toEqual(['PAN-001', 'PAN-005', 'PAN-017', 'PAN-018'])
  })
})

describe('parseExcludedRuleIds — fail-open to today’s behavior', () => {
  it('missing config row (undefined) → no exclusions — the benign deploy ordering: code shipped before the migration serves the pre-fix list', () => {
    expect(parseExcludedRuleIds(undefined)).toEqual([])
  })

  it('malformed values → no exclusions, never a throw', () => {
    expect(parseExcludedRuleIds(null)).toEqual([])
    expect(parseExcludedRuleIds('PAN-016')).toEqual([])
    expect(parseExcludedRuleIds({ ids: ['PAN-016'] })).toEqual([])
    expect(parseExcludedRuleIds(42)).toEqual([])
  })

  it('non-string members are dropped; well-formed arrays pass through', () => {
    expect(parseExcludedRuleIds(['PAN-016', 7, null, 'PAN-017'])).toEqual(['PAN-016', 'PAN-017'])
    expect(parseExcludedRuleIds([])).toEqual([])
    expect(parseExcludedRuleIds(['PAN-016', 'PAN-017', 'PAN-018'])).toEqual([
      'PAN-016',
      'PAN-017',
      'PAN-018',
    ])
  })
})

describe('parseDefaultOfficeId', () => {
  it('string passes through; anything else (missing row included) → null', () => {
    expect(parseDefaultOfficeId('11000000-0000-0000-0000-000000000001')).toBe(
      '11000000-0000-0000-0000-000000000001'
    )
    expect(parseDefaultOfficeId(undefined)).toBeNull()
    expect(parseDefaultOfficeId(null)).toBeNull()
    expect(parseDefaultOfficeId(42)).toBeNull()
  })
})

it('the config keys are the DB keys the migrations seed', () => {
  expect(DEFAULT_OFFICE_CONFIG_KEY).toBe('default_document_office_id')
  expect(FALLBACK_EXCLUSIONS_CONFIG_KEY).toBe('fallback_excluded_rule_ids')
})
