/**
 * The case header's title (UI round 2 / R2-2, founder decision D3).
 *
 * The header names the CARE RECIPIENT, not the caregiver who signed up:
 * "Antrag für Maria Musterfrau".
 *
 * The two keys are `first_name` / `last_name`, top-level (non-group) questions
 * in the first category of BOTH questionnaires (Berlin `antragsteller`
 * sort 0/1; Essen sort 1/0 — it asks the surname first, which does not affect
 * the lookup). Both are required `short_text`, so a locked case always has
 * them. The group-scoped `child_first_name` / `spouse_*` keys cannot collide:
 * the answers map is keyed by question_key for the 'default' instance only.
 *
 * Until BOTH are answered the header shows the standing `case.subheading`
 * value verbatim — which already reads "Mein Hilfe zur Pflege Antrag", i.e.
 * exactly the fallback D3 asks for, so no extra content row exists for it.
 * Half a name is not a title: one answered and one missing still falls back.
 *
 * A missing `pattern` (the content row not yet seeded) also falls back, which
 * is the rollout contract with migration 20260814000001 — code may deploy
 * before the rows and simply keeps today's title.
 */
export function caseHeaderTitle(
  answers: Record<string, unknown>,
  pattern: string,
  fallback: string
): string {
  const first = typeof answers['first_name'] === 'string' ? answers['first_name'].trim() : ''
  const last = typeof answers['last_name'] === 'string' ? answers['last_name'].trim() : ''
  if (!first || !last || !pattern) return fallback
  return pattern.replace('{first_name}', first).replace('{last_name}', last)
}
