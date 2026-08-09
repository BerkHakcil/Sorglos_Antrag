/**
 * Documents-pane gating (pass 4, D3) — pure, unit-tested.
 *
 * The Dokumente tab exists from FIRST LOGIN (pre-steps included), but what
 * the pane shows depends on how far the case has progressed:
 *
 *   'placeholder' — no questionnaire yet (care home / PLZ pre-steps): the
 *                   checklist cannot be computed before the PLZ decides the
 *                   office, so the pane shows Roman's placeholder text
 *                   (static_content 'docs.placeholder_needs_plz').
 *   'list'        — questionnaire resolved and the office (or the default)
 *                   produced slots: the live checklist renders.
 *   'none'        — questionnaire resolved but zero rules exist anywhere
 *                   (safety branch, unreachable while a default office is
 *                   configured): the chat renders alone, no tab bar. The
 *                   placeholder would be FALSE here — the PLZ already exists.
 */
export type DocsPaneMode = 'placeholder' | 'list' | 'none'

export function docsPaneMode(hasQuestionnaire: boolean, slotCount: number): DocsPaneMode {
  if (!hasQuestionnaire) return 'placeholder'
  return slotCount > 0 ? 'list' : 'none'
}

/**
 * Go-live fallback banner — pure, unit-tested. Returns the notice text to
 * render above the checklist, or null for "no banner".
 *
 * The banner exists to be HONEST about a generic list: it renders exactly
 * when the checklist came from the default-office fallback branch
 * (dal.ts getDocumentData → rulesSource 'fallback'). A case whose own office
 * has rules (Pankow, Essen) must NEVER see it, and it cannot exist without a
 * rendered list ('list' mode only — the pre-PLZ placeholder state is
 * unchanged). Empty text degrades to no banner, so the code is safe to
 * deploy before the static_content row lands (CLAUDE.md rule #8's benign
 * row-add case).
 */
export function fallbackNoticeText(
  rulesSource: 'own' | 'fallback' | 'none',
  mode: DocsPaneMode,
  noticeDe: string
): string | null {
  if (rulesSource !== 'fallback' || mode !== 'list' || noticeDe === '') return null
  return noticeDe
}
