import { describe, it, expect } from 'vitest'
import { docsPaneMode } from '@/lib/docs-pane'

/**
 * Pass 4 / D3 — the Dokumente tab exists from first login; what the pane
 * shows is a pure function of case progress. The 'none' branch is the
 * long-standing safety branch (no rules and no default office), NOT the
 * pre-PLZ state — showing the "enter your PLZ first" placeholder there
 * would be false, because that case already has a PLZ.
 */
describe('docsPaneMode (D3)', () => {
  it('pre-steps (no questionnaire yet) → placeholder, regardless of slot count', () => {
    expect(docsPaneMode(false, 0)).toBe('placeholder')
    // Slots cannot exist without a questionnaire; the mode must not flip even
    // if a caller passed a nonsense count.
    expect(docsPaneMode(false, 5)).toBe('placeholder')
  })

  it('questionnaire resolved + slots → the live checklist', () => {
    expect(docsPaneMode(true, 1)).toBe('list')
    expect(docsPaneMode(true, 13)).toBe('list')
  })

  it('questionnaire resolved + zero slots → chat alone (safety branch), never the placeholder', () => {
    expect(docsPaneMode(true, 0)).toBe('none')
  })
})

// The fallbackNoticeText tests were removed with the function itself
// (fallback-docs fix, 2026-08-26). The banner's never-returns guards are the
// e2e count-0 asserts in tests/e2e/fallback-notice.spec.ts.
