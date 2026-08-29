import { describe, it, expect } from 'vitest'
import { periodSuffix } from '@/lib/document-rules'

/**
 * Pass 4 / D10 — the per-office bank-statement period suffix.
 *
 * The German template lives in static_content ('docs.period_suffix' =
 * "(letzte {n} Monate)"); the helper only fills {n}. Founder decision
 * 2026-08-01: render wherever period_months is non-NULL.
 *
 * Bank-docs pass (GATE 1, 2026-08-29): the 2026-08-11 fallback suppression
 * (third argument `fromFallbackRules`) was LIFTED — Roman ruled a default
 * period (3 months) that explicitly covers fallback-served lists, so the
 * suffix now renders from the rule rows on every list. Live values after
 * migration 20260829000001: Pankow PAN-005/006 = 3, Essen ESS-010/011 = 4.
 */
const TEMPLATE = '(letzte {n} Monate)'

describe('periodSuffix (D10)', () => {
  it('renders the live Pankow/default 3-month case', () => {
    expect(periodSuffix(3, TEMPLATE)).toBe('(letzte 3 Monate)')
  })

  it('renders the live Essen 4-month case', () => {
    expect(periodSuffix(4, TEMPLATE)).toBe('(letzte 4 Monate)')
  })

  it('composes to the approved display form after a slot name + instance label', () => {
    const display = `Kontoauszüge – Girokonto ${periodSuffix(3, TEMPLATE)}`
    expect(display).toBe('Kontoauszüge – Girokonto (letzte 3 Monate)')
  })

  it('renders NULL/undefined period unchanged (empty suffix) — the non-bank rules', () => {
    expect(periodSuffix(null, TEMPLATE)).toBe('')
    expect(periodSuffix(undefined, TEMPLATE)).toBe('')
  })

  it('renders NOTHING for n = 1: the plural template would be wrong German, and singular wording needs Roman first (R3)', () => {
    expect(periodSuffix(1, TEMPLATE)).toBe('')
  })

  it('renders nothing for zero/negative values (defensive — no such rule exists)', () => {
    expect(periodSuffix(0, TEMPLATE)).toBe('')
    expect(periodSuffix(-3, TEMPLATE)).toBe('')
  })

  it('degrades to empty when the template row is missing (static_content → "")', () => {
    expect(periodSuffix(3, '')).toBe('')
  })

  it('fills arbitrary n >= 2 (a future office with a different period)', () => {
    expect(periodSuffix(6, TEMPLATE)).toBe('(letzte 6 Monate)')
    expect(periodSuffix(12, TEMPLATE)).toBe('(letzte 12 Monate)')
  })
})
