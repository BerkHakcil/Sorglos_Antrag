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
 * (There is a `components/ui/button.tsx` from the shadcn scaffold. It is
 * imported by nothing and still carries the pre-E-1 palette. Left alone here
 * rather than half-adopted; its fate is a separate decision.)
 *
 * ── Colour rules encoded below, all measured, none assumed ──────────────
 *  • Copper is a FILL. White on copper = 4.69:1 (AA). Copper as TEXT on the
 *    cream page is 4.27:1 and on cream-deep 3.91:1 — both FAIL AA at normal
 *    size, so copper never appears as text. Links use petrol (7.03:1).
 *  • Control boundaries use `border-input` (#8c8272), not `border-border`
 *    (#e6e0d0). See the token split in globals.css.
 *  • Focus is a full-opacity petrol ring with an offset, not the mockup's
 *    `ring-petrol/20` — at 20% alpha the ring is ~1.2:1 against a white card
 *    and effectively invisible, which is a 2.4.7 failure. The offset is what
 *    keeps the ring legible on a control whose own border is already dark.
 */

/** Focus treatment shared by every interactive element. */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-petrol focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Native form controls: text/number/date/month inputs, selects, textareas.
 * `w-full` is intentionally NOT included — date/month inputs size to content.
 */
export const control = `border-input bg-card rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

/** The common case: a control that fills its row. */
export const controlFull = `${control} w-full`

/** Checkbox / radio: petrol tick via accent-color, matching focus treatment. */
export const controlTick = `accent-petrol size-4 shrink-0 ${focusRing}`

const buttonBase = `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 ${focusRing}`

/** Primary call to action — copper fill, white text. One per screen. */
export const btnCopper = `${buttonBase} bg-copper px-5 py-2.5 text-white hover:bg-copper-hover`

/** Secondary affirmative — petrol fill. */
export const btnPetrol = `${buttonBase} bg-primary text-primary-foreground px-4 py-2 hover:bg-petrol-soft`

/** Neutral / dismissive — outlined, decorative border (not a control edge). */
export const btnOutline = `${buttonBase} border-border text-foreground bg-card border px-4 py-2 hover:bg-cream-deep`

/** Lowest emphasis — no chrome until hover. */
export const btnGhost = `${buttonBase} text-graphite-soft hover:bg-cream-deep hover:text-foreground px-3 py-2`

/** Inline text link. Petrol, never copper. */
export const linkPetrol = `text-primary underline-offset-4 hover:underline ${focusRing} rounded-sm`

/** The mockup's signature card: white, generous radius, petrol-tinted lift. */
export const card = 'bg-card rounded-2xl shadow-card'

/** Card variant carrying the heavier lift the mockup uses on auth screens. */
export const cardLg = 'bg-card rounded-2xl shadow-card-lg'

/** Field label. */
export const fieldLabel = 'text-foreground text-sm font-medium'

/** Helper/hint text under a field. */
export const fieldHint = 'text-graphite-soft text-xs'
