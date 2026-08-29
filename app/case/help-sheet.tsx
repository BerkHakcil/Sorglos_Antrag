'use client'

/**
 * Pass 4, D11 — the Ansprechpartner contact sheet, opened from a "Hilfe"
 * button in the brand header (the mockup's AppHeader/ContactPanel pattern;
 * placement decided by the founder 2026-08-01). Reachable from every state
 * including the pre-steps — the phase where a confused relative most needs a
 * phone number.
 *
 * All visible German comes from static_content (contact.* rows): the name,
 * phone and email are Roman-approved data; the button word and card label
 * were approved as proposed via roman_package_pass4.md §4 (Erman 2026-08-01,
 * Roman review waived — final copy). Only the close button's sr-only
 * "Schließen" label (de.ts) remains PLACEHOLDER_DE. The avatar is the "RP"
 * initials circle until Roman's photo arrives — passing `photoSrc` is the
 * drop-in slot (D11: photo pending, not integrated).
 *
 * base-ui Dialog provides focus trap, Escape and backdrop dismissal.
 *
 * UI review round 1 / U4 (GATE 1 APPROVED 2026-08-29): ONE behavior at every
 * width — below `sm` the bottom sheet (the true-mobile chrome, unchanged);
 * from `sm` up a single CENTERED modal over the dimmed page. This supersedes
 * BOTH previous sm+ chromes: the right slide-over (the old 'panel' shape the
 * burger exposed in the sm–lg band) and D9's desktop bottom sheet — a
 * founder-confirmed REVERSAL of the D9 decision (2026-08-28 → reversed
 * 2026-08-29). The former `variant` prop is gone with them: both page.tsx
 * instances now render identically.
 */

import Image from 'next/image'
import { Dialog } from '@base-ui/react/dialog'
import { Phone, X } from 'lucide-react'
import { de } from '@/lib/strings/de'
import { btnGhost, focusRing, linkPetrol, linkStandalone } from '@/components/ui/styles'

type Props = {
  helpButton: string
  cardLabel: string
  name: string
  phone: string
  email: string
  /** Roman's photo (public/ path) — the initials circle is the no-photo
   *  fallback only (U3 shipped the real photo to every instance). */
  photoSrc?: string
  /** R2-1: the trigger sits in the top bar on mobile and in the sidebar foot
   *  on desktop, at different type scales. Only the trigger chrome varies. */
  triggerClassName?: string
}

/** "Roman Pfeiffer" → "RP" (first letter of the first two words). */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function HelpSheet({
  helpButton,
  cardLabel,
  name,
  phone,
  email,
  photoSrc,
  triggerClassName,
}: Props) {
  // Missing static_content rows degrade to '' by design — without the button
  // word there is nothing to render a trigger with, so the feature waits for
  // its content instead of showing an empty button.
  if (!helpButton || !name) return null

  /* U4: one chrome. Below `sm` the shipped bottom sheet, byte-identical
     (mobile untouched). From `sm` a centered modal: fixed at the viewport
     midpoint, max-w-md over the dimmed backdrop. No entry animation on
     purpose — the shipped mobile sheet never had one, and D9's slide-up is
     superseded along with its bottom-sheet geometry. The load-bearing
     data-closed:hidden still snaps the closed dialog away (base-ui keeps it
     mounted and only stamps [data-closed]). */
  const popupClass =
    'bg-card shadow-card-lg fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-6 data-closed:hidden sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl'

  return (
    <Dialog.Root>
      <Dialog.Trigger className={triggerClassName ?? `${btnGhost} px-3 py-1.5 text-xs`}>
        {helpButton}
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* data-closed:hidden is LOAD-BEARING, not styling: base-ui stamps
            [data-closed] on close but keeps both elements mounted — without
            this the invisible-state backdrop stays a full-screen click shield
            over the whole app (found in the Batch-1 visual check: the closed
            sheet swallowed the pre-step submit click). */}
        <Dialog.Backdrop className="bg-graphite/40 fixed inset-0 z-40 data-closed:hidden" />
        <Dialog.Popup className={popupClass}>
          <div className="flex items-start justify-between gap-2">
            <Dialog.Title className="text-graphite-soft text-xs font-semibold tracking-wide uppercase">
              {cardLabel}
            </Dialog.Title>
            <Dialog.Close
              aria-label={de.case.help.closeLabel}
              className={`text-graphite-soft hover:text-foreground -mt-2 -mr-2 inline-flex size-11 items-center justify-center rounded-lg ${focusRing}`}
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {photoSrc ? (
              /* alt=""/aria-hidden (D9, unchanged for the real photo — U3):
                 the photo repeats nothing the adjacent name text doesn't say —
                 the burger-menu treatment set the precedent. */
              <Image
                src={photoSrc}
                alt=""
                aria-hidden
                data-testid="help-sheet-photo"
                width={56}
                height={56}
                unoptimized
                className="size-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              /* aria-hidden: the initials repeat nothing a screen reader needs —
                 the name follows as text. White on petrol measures 7.61:1
                 (re-measured 2026-08-27, R8 values). */
              <span
                aria-hidden
                className="bg-primary grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold text-white"
              >
                {initialsOf(name)}
              </span>
            )}
            <p className="text-foreground text-lg font-semibold">{name}</p>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {phone && (
              <li>
                {/* The call pictogram (from D9's sheet) rides along into the
                    U4 modal — every sm+ chrome shows it; below sm the row
                    stays byte-identical to the shipped mobile sheet (no
                    icon). aria-hidden — the visible number is the accessible
                    name, so the icon needs no German label (burger
                    tap-to-call precedent). */}
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className={`${linkPetrol} ${linkStandalone} gap-2`}
                >
                  <Phone aria-hidden className="size-4 shrink-0 max-sm:hidden" />
                  {phone}
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className={`${linkPetrol} ${linkStandalone} break-all`}>
                  {email}
                </a>
              </li>
            )}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
