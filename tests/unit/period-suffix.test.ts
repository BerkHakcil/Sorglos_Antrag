import { describe, it, expect } from 'vitest'
import { periodSuffix } from '@/lib/document-rules'

/**
 * Pass 4 / D10 — the per-office bank-statement period suffix.
 *
 * The German template lives in static_content ('docs.period_suffix' =
 * "(letzte {n} Monate)"); the helper only fills {n}. Founder decision
 * 2026-08-01: render wherever period_months is non-NULL — that includes
 * Pankow (PAN-005/006 carry 4, same as Essen's ESS-010/011).
 */
const TEMPLATE = '(letzte {n} Monate)'

describe('periodSuffix (D10)', () => {
  it('renders the live 4-month case exactly as Roman approved it', () => {
    expect(periodSuffix(4, TEMPLATE)).toBe('(letzte 4 Monate)')
  })

  it('composes to the approved display form after a slot name + instance label', () => {
    const display = `Kontoauszüge – Girokonto ${periodSuffix(4, TEMPLATE)}`
    expect(display).toBe('Kontoauszüge – Girokonto (letzte 4 Monate)')
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
    expect(periodSuffix(4, '')).toBe('')
  })

  it('fills arbitrary n >= 2 (a future office with a different period)', () => {
    expect(periodSuffix(6, TEMPLATE)).toBe('(letzte 6 Monate)')
    expect(periodSuffix(12, TEMPLATE)).toBe('(letzte 12 Monate)')
  })
})
