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
