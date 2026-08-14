import { describe, it, expect } from 'vitest'
import { caseHeaderTitle } from '@/lib/case-header'

/**
 * UI round 2 / R2-2 (D3). These cover the branch the gallery cannot show
 * until migration 20260814000001 is pushed: with the content row absent the
 * header must fall back rather than render "Antrag für  " or an empty line.
 */
const PATTERN = 'Antrag für {first_name} {last_name}'
const FALLBACK = 'Mein Hilfe zur Pflege Antrag'

describe('caseHeaderTitle', () => {
  it('renders the care recipient once both names are answered', () => {
    expect(
      caseHeaderTitle({ first_name: 'Maria', last_name: 'Musterfrau' }, PATTERN, FALLBACK)
    ).toBe('Antrag für Maria Musterfrau')
  })

  it('falls back until BOTH names exist — half a name is not a title', () => {
    expect(caseHeaderTitle({ first_name: 'Maria' }, PATTERN, FALLBACK)).toBe(FALLBACK)
    expect(caseHeaderTitle({ last_name: 'Musterfrau' }, PATTERN, FALLBACK)).toBe(FALLBACK)
    expect(caseHeaderTitle({}, PATTERN, FALLBACK)).toBe(FALLBACK)
  })

  it('treats whitespace-only answers as unanswered', () => {
    expect(caseHeaderTitle({ first_name: '  ', last_name: 'Musterfrau' }, PATTERN, FALLBACK)).toBe(
      FALLBACK
    )
  })

  it('trims stray whitespace around a real name', () => {
    expect(
      caseHeaderTitle({ first_name: ' Maria ', last_name: ' Musterfrau ' }, PATTERN, FALLBACK)
    ).toBe('Antrag für Maria Musterfrau')
  })

  it('falls back when the content row is missing — the rollout contract', () => {
    // getStaticContent degrades an absent key to ''. Code may deploy before
    // migration 20260814000001; the header then keeps today's title.
    expect(caseHeaderTitle({ first_name: 'Maria', last_name: 'Musterfrau' }, '', FALLBACK)).toBe(
      FALLBACK
    )
  })

  it('ignores non-string answer values', () => {
    // Answers are JSONB: a corrupted or wrongly-typed row must not stringify
    // into the header.
    expect(caseHeaderTitle({ first_name: 42, last_name: { x: 1 } }, PATTERN, FALLBACK)).toBe(
      FALLBACK
    )
  })
})
