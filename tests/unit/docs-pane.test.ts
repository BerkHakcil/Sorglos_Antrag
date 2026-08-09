import { describe, it, expect } from 'vitest'
import { docsPaneMode, fallbackNoticeText } from '@/lib/docs-pane'

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

/**
 * Go-live out-of-coverage banner — renders exactly on the default-office
 * fallback branch, above a rendered list, with authored text. Every other
 * combination is a hard null: an own-office case (Pankow/Essen) must never
 * be told its list is generic, and no state may show an empty panel.
 */
describe('fallbackNoticeText (go-live banner)', () => {
  const TEXT = 'Hinweis: Für Ihre Postleitzahl …'

  it('fallback rules + rendered list + text → the notice', () => {
    expect(fallbackNoticeText('fallback', 'list', TEXT)).toBe(TEXT)
  })

  it('own-office rules (Pankow/Essen case) → never, regardless of mode', () => {
    expect(fallbackNoticeText('own', 'list', TEXT)).toBeNull()
    expect(fallbackNoticeText('own', 'none', TEXT)).toBeNull()
  })

  it('no rules at all (safety branch, nothing rendered) → null', () => {
    expect(fallbackNoticeText('none', 'none', TEXT)).toBeNull()
  })

  it('pre-PLZ placeholder state stays unchanged — no banner before a list exists', () => {
    expect(fallbackNoticeText('fallback', 'placeholder', TEXT)).toBeNull()
    expect(fallbackNoticeText('none', 'placeholder', TEXT)).toBeNull()
  })

  it('missing static_content row (pre-migration deploy) degrades to no banner, not an empty panel', () => {
    expect(fallbackNoticeText('fallback', 'list', '')).toBeNull()
  })
})
