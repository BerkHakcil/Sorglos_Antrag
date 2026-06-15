/**
 * Pure PLZ → Sozialamt resolver.
 *
 * Extracted from the Milestone 1 inline test so it can be:
 *   1. Unit-tested independently (tests/unit/plz-routing.test.ts)
 *   2. Called by the DB-backed server action in app/case/actions.ts
 *
 * The resolver is deliberately pure (no I/O): the caller passes rules fetched
 * from the DB (or fixtures in tests) and gets back a social_office_id or null.
 * Higher priority wins when ranges overlap; equal-length text comparison is
 * equivalent to numeric comparison for zero-padded 5-digit German PLZ strings.
 */

export type PlzRule = {
  plz_from: string
  plz_to: string
  priority: number
  social_office_id: string
}

/**
 * Returns the social_office_id of the highest-priority rule whose range
 * includes `plz`, or null if no rule matches.
 */
export function resolveOffice(plz: string, rules: PlzRule[]): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  const match = sorted.find((r) => plz >= r.plz_from && plz <= r.plz_to)
  return match?.social_office_id ?? null
}
