/**
 * Phase E-2 — shared visual primitives for the Lovable-mockup restyle.
 *
 * These are CLASS STRINGS, not React components, and that is deliberate.
 *
 * The app renders native `<button>`, `<input>`, `<select>` and `<textarea>`
 * everywhere; the e2e suite selects on exactly those tags and on their `id` /
 * `name` / `type` / `value` attributes (`#care_home_id`, `[name=email]`,
 * `input[type=radio][value="Nein"]`, `locator('select')`, …). Wrapping them in
 * components would put a rendering layer between the test and the element it
 * asserts on, for no visual gain — the restyle is entirely a class-name
 * change. Sharing the strings gets the single source of truth without
 * touching a single DOM node or attribute.
 *
 * (The shadcn scaffold's `components/ui/button.tsx` was deleted rather than
 * restyled: nothing imported it, so a fixed-up copy would have been an
 * untested component that drifts off-brand again at the next token change.
 * `components.json` is present, so `npx shadcn add button` regenerates one
 * against the current tokens if a real need appears.)
 *
 * ── Colour rules encoded below, all measured, none assumed ──────────────
 *    (re-measured 2026-08-27 for the mobile-round-3 R8 brand values)
 *  • Copper is a FILL. White #FFFDFA on copper = 4.62:1 (AA). Copper as
 *    TEXT on the cream page is 4.25:1 — FAILS AA at normal size, so copper
 *    never appears as text. Links use petrol (6.99:1 on cream).
 *  • Control boundaries use `border-input` (#868383, 3.69:1 on white /
 *    3.39:1 on cream), not `border-border` (#e8e3dc, decorative). See the
 *    token split in globals.css.
 *  • Focus is a full-opacity petrol ring with an offset, not the mockup's
 *    `ring-petrol/20` — at 20% alpha the ring is ~1.2:1 against a white card
 *    and effectively invisible, which is a 2.4.7 failure. The offset is what
 *    keeps the ring legible on a control whose own border is already dark.
 *
 * ── SEMANTIC COLOUR RULE (founder decision, 2026-07-31; re-affirmed as the
 * one R8 palette exception via `--semantic-error`, gate answer 6a,
 * 2026-08-27) ────────────────────────────────────────────────────────────
 * **Amber and red are reserved for genuine warnings and errors.** Neither
 * may be used for an ordinary, expected, non-problematic state.
 *
 * A state the user simply has not reached yet is NOT a warning. Concretely:
 * a document that has not been uploaded ("Fehlt") is neutral/muted, never
 * amber or red; a re-asked question is guidance, so it is the sage hint
 * bubble. Positive tones (petrol, sage) are available for confirmed and
 * completed states. `--destructive` stays for real errors only.
 *
 * Precedent: E-3 moved the re-ask note and the patient banner off an amber
 * alert palette they never warranted.
 */

/** Focus treatment shared by every interactive element. */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-petrol focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Native form controls: text/number/date/month inputs, selects, textareas.
 * `w-full` is intentionally NOT included — date/month inputs size to content.
 * `min-h-11` (44px) since the E-7 audit: selects and inputs measured 36–40px
 * tall at the mobile viewport, under the touch-target minimum.
 */
export const control = `border-input bg-card min-h-11 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

/** The common case: a control that fills its row. */
export const controlFull = `${control} w-full`

/** Checkbox / radio: petrol tick via accent-color, matching focus treatment. */
export const controlTick = `accent-petrol size-4 shrink-0 ${focusRing}`

/* `min-h-11` since the E-7 audit: every button measured 32–40px tall at the
   mobile viewport. 44px is the touch-target floor, applied at the base so no
   per-site padding override can silently drop below it again. */
const buttonBase = `inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 ${focusRing}`

/** Primary call to action — copper fill, white text. One per screen. */
export const btnCopper = `${buttonBase} bg-copper px-5 py-2.5 text-white hover:bg-copper-hover`

/** Secondary affirmative — petrol fill. */
export const btnPetrol = `${buttonBase} bg-primary text-primary-foreground px-4 py-2 hover:bg-petrol-soft`

/** Neutral / dismissive — outlined, decorative border (not a control edge). */
export const btnOutline = `${buttonBase} border-border text-foreground bg-card border px-4 py-2 hover:bg-cream-deep`

/** Lowest emphasis — no chrome until hover. */
export const btnGhost = `${buttonBase} text-graphite-soft hover:bg-cream-deep hover:text-foreground px-3 py-2`

/** Inline text link. Petrol, never copper.
 *  Stays at text height on purpose: it is used INSIDE sentences (consent
 *  labels), where WCAG 2.5.8's inline exception applies and a 44px box would
 *  wreck line layout. A STANDALONE link (form footers, back links) must add
 *  `linkStandalone` to get the touch-target floor. */
export const linkPetrol = `text-primary underline-offset-4 hover:underline ${focusRing} rounded-sm`

/** Add to linkPetrol when the link stands alone rather than inside a sentence. */
export const linkStandalone = 'inline-flex min-h-11 items-center'

/** The mockup's signature card: white, generous radius, petrol-tinted lift. */
export const card = 'bg-card rounded-2xl shadow-card'

/** Card variant carrying the heavier lift the mockup uses on auth screens. */
export const cardLg = 'bg-card rounded-2xl shadow-card-lg'

/** Field label. */
export const fieldLabel = 'text-foreground text-sm font-medium'

/** Helper/hint text under a field. */
export const fieldHint = 'text-graphite-soft text-xs'
