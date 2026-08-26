/**
 * Document-rule source resolution — pure, shared, single source of truth
 * (fallback-docs fix, 2026-08-26). Before this module the own-office →
 * default-office ladder existed twice (lib/dal.ts getDocumentData and
 * scripts/case-export.mjs) and had already drifted once (the export lacked
 * the fallback branch until 2026-08-11). Both consumers now fetch rows and
 * config as before, then delegate the DECISION — which rule set serves the
 * case, and with which source label — to resolveEffectiveRules().
 *
 * Fallback exclusions (Gate 1, founder 2026-08-26 — Line A): the default
 * office's set contains entries that are that office's house requirements,
 * not generic ones. Cases served by the FALLBACK branch get the default set
 * minus the ids listed in app_config 'fallback_excluded_rule_ids'; a case
 * whose OWN office owns rules is never filtered — Pankow's and Essen's own
 * checklists are byte-identical to before, by construction.
 *
 * Failure semantics are fail-open to TODAY'S behavior: a missing config row,
 * a malformed value, or an unknown id must never brick the checklist — they
 * degrade to "no exclusions" (the pre-fix list). This is what makes the
 * deploy ordering benign (CLAUDE.md rule #8's row-add case): the code may
 * ship before the migration, and until the row lands the app behaves exactly
 * as before. Pinned by tests/unit/rules-source.test.ts.
 *
 * NOTE for scripts/*.mjs consumers: this module must keep ZERO imports
 * (Node type-stripping cannot resolve '@/…' aliases — see the M8 report on
 * the .mjs → .ts bridge).
 */

/**
 * Where a case's document rules came from — carried alongside the rules so
 * downstream rendering can react without re-deriving the decision:
 *
 *   'own'      — the case's resolved office has its own active rule set
 *                (today: Pankow, Essen). Never filtered by exclusions.
 *   'fallback' — the rules are the configured default office's (the case's
 *                office has none, or the PLZ resolved no office at all),
 *                minus the configured fallback exclusions. Period suffixes
 *                are suppressed on this branch (an office-specific claim the
 *                default list must not make — lib/document-rules.ts).
 *   'none'     — no rules from either source (safety branch: no documents
 *                pane renders).
 */
export type RulesSource = 'own' | 'fallback' | 'none'

/** app_config keys read by the resolution ladder. Values change by migration
 *  only. Any migration touching PAN rules OR default_document_office_id must
 *  re-review fallback_excluded_rule_ids (standing rule — the exclusion ids
 *  are keyed to the default office's rule set). */
export const DEFAULT_OFFICE_CONFIG_KEY = 'default_document_office_id'
export const FALLBACK_EXCLUSIONS_CONFIG_KEY = 'fallback_excluded_rule_ids'

/** Parses app_config.default_document_office_id — same guard shape the
 *  ladder always used: non-string (missing row included) → null. */
export function parseDefaultOfficeId(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Parses app_config.fallback_excluded_rule_ids. FAIL-OPEN: anything that is
 * not an array yields no exclusions (today's behavior), and non-string
 * members are dropped. An id that matches no rule excludes nothing at
 * runtime; the seeding migration and the live verification script assert the
 * listed ids actually exist in the default office's active set, so a typo is
 * caught at push time, not silently at render time.
 */
export function parseExcludedRuleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

export type ResolvedRules<R> = { rules: R[]; rulesSource: RulesSource }

/**
 * The ladder decision, pure. Consumers fetch exactly what they always
 * fetched (own rules; if none, the config rows and then the default
 * office's rules) and pass the results in — this function only decides.
 *
 *   1. An office WITH active rules always uses its own, unfiltered.
 *   2. Otherwise the default office's set serves, MINUS the exclusions —
 *      guarded by defaultOfficeId !== socialOfficeId so the default office
 *      itself can never be served its own set as "fallback".
 *   3. Anything else (no default configured, default set empty, or emptied
 *      by exclusions) → 'none'.
 */
export function resolveEffectiveRules<R extends { id: string }>(args: {
  socialOfficeId: string | null
  ownRules: R[]
  defaultOfficeId: string | null
  defaultRules: R[]
  excludedRuleIds: readonly string[]
}): ResolvedRules<R> {
  const { socialOfficeId, ownRules, defaultOfficeId, defaultRules, excludedRuleIds } = args

  if (ownRules.length > 0) {
    return { rules: ownRules, rulesSource: 'own' }
  }

  if (defaultOfficeId && defaultOfficeId !== socialOfficeId) {
    const excluded = new Set(excludedRuleIds)
    const rules = excluded.size > 0 ? defaultRules.filter((r) => !excluded.has(r.id)) : defaultRules
    if (rules.length > 0) {
      return { rules, rulesSource: 'fallback' }
    }
  }

  return { rules: [], rulesSource: 'none' }
}
