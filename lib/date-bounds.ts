/**
 * App-wide date bounds (go-live round 2, item 5).
 *
 * Feedback pass 2 set ONE bound for every date field (1900-01-01 …
 * (currentYear+1)-12-31) to kill a real year-22000 typo. That cap made
 * future-oriented fields unusable: a Personalausweis or Schwerbehinderten-
 * ausweis valid until 2031+ could not be entered. This module keeps the
 * pass-2 default for past-oriented fields and widens ONLY the future-oriented
 * keys below to today + 10 years.
 *
 * The classification lives in CODE, not per-question validation JSONB, by
 * deliberate decision (founder GO 2026-08-13; pass-2 precedent "one
 * consistent bound, no per-question DB validation" — see
 * docs/feedback/golive_round2.md item 5 for the recorded rule-1 tension).
 * Keys are stable machine identifiers, not German prose.
 *
 * Consumed by BOTH the client DateInput (UX layer) and the server
 * validateAnswerValue (the real gate) so the two cannot diverge.
 */

export const DATE_MIN = '1900-01-01'

/**
 * Expiries / valid-until / due dates that may legitimately lie years in the
 * future. Everything else keeps the pass-2 default bound — in particular
 * birth dates and other past-event dates deliberately do NOT widen
 * ("Geburtsdaten bleiben bewusst vergangenheitsbeschränkt").
 *
 * `disability_card_expiry` / `spouse_disability_card_expiry` exist in BOTH
 * questionnaires under the same key; the ID-expiry pair is Berlin-only.
 * Full classified inventory: docs/feedback/golive_round2.md item 5.
 */
export const FUTURE_ORIENTED_DATE_KEYS: ReadonlySet<string> = new Set([
  'id_expiry_date',
  'spouse_id_expiry_date',
  'disability_card_expiry',
  'spouse_disability_card_expiry',
  'rent_paid_until',
  'rent_contract_terminated_by',
  'former_rent_paid_until',
  'former_rent_contract_terminated_by',
  'last_health_insurance_until',
  'spouse_last_health_insurance_until',
  'private_pension_due_date',
  'spouse_private_pension_due_date',
  'state_subsidized_private_pension_due_date',
  'spouse_state_subsidized_private_pension_due_date',
])

/**
 * Max storable date for a date question, as ISO YYYY-MM-DD.
 * Future-oriented keys: today + 10 years (rolling; Feb-29 rolls to Mar-1).
 * Everything else: the pass-2 bound, (currentYear+1)-12-31.
 *
 * `today` is injectable for deterministic tests. BOTH branches use UTC
 * semantics (toISOString / getUTCFullYear) so browser-local and server-UTC
 * callers compute the same bound; the only residual skew is the hours around
 * a UTC year boundary, where the bound may differ from wall-clock "today" by
 * one day — harmless on year-scale bounds.
 */
export function dateMaxFor(questionKey: string, today: Date = new Date()): string {
  if (FUTURE_ORIENTED_DATE_KEYS.has(questionKey)) {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + 10)
    return d.toISOString().slice(0, 10)
  }
  return `${today.getUTCFullYear() + 1}-12-31`
}

/**
 * True iff `value` is a real ISO calendar date (YYYY-MM-DD). The format regex
 * alone admits impossible dates like 2026-02-30, which Date() silently rolls
 * over (→ Mar 2); the round-trip comparison catches every rollover because
 * date-only ISO strings parse as UTC midnight, making toISOString exact.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  if (isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}
