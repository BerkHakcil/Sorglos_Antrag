'use client'

/**
 * Mobile round 3 / R2 — the burger side menu (below `lg` only; the desktop
 * sidebar is untouched). Founder-confirmed reversal of UI-round-2 decision D2
 * (mobile = top-bar + tabs): the top bar now carries burger + applicant name,
 * and everything the old top bar held lives in this menu.
 *
 * The menu CONTENT arrives server-rendered as children (page.tsx builds it):
 * the logout form posts to a Server Action and the logo/photo/contact rows
 * have no reason to ship as client code — the exact pattern CaseTabs uses for
 * its sidebar chrome. This component owns only the trigger and the dialog
 * shell.
 *
 * base-ui Dialog provides focus trap, Escape and backdrop dismissal.
 * data-closed:hidden is LOAD-BEARING, not styling (HelpSheet precedent,
 * Batch-1 visual check): base-ui keeps both elements mounted after close and
 * only stamps [data-closed] — without the class the invisible backdrop stays
 * a full-screen click shield over the app.
 *
 * All three German strings here are assistive-tech-only labels
 * (PLACEHOLDER_DE, see de.ts case.menu + ledger).
 */

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { de } from '@/lib/strings/de'
import { focusRing } from '@/components/ui/styles'

const m = de.case.menu

export function MobileMenu({ children }: { children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={m.openLabel}
        data-testid="mobile-menu-trigger"
        className={`text-foreground hover:bg-cream-deep inline-flex size-11 shrink-0 items-center justify-center rounded-lg ${focusRing}`}
      >
        <Menu aria-hidden className="size-6" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-graphite/40 fixed inset-0 z-40 data-closed:hidden" />
        {/* Left slide-over per the mockup (the HelpSheet keeps the right
            side / bottom sheet, so the two dialogs never read as one). */}
        <Dialog.Popup
          data-testid="mobile-menu"
          className="bg-card shadow-card-lg fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto rounded-r-2xl p-6 data-closed:hidden"
        >
          <div className="flex items-start justify-between">
            <Dialog.Title className="sr-only">{m.title}</Dialog.Title>
            <Dialog.Close
              aria-label={m.closeLabel}
              className={`text-graphite-soft hover:text-foreground -mt-2 -ml-2 inline-flex size-11 items-center justify-center rounded-lg ${focusRing}`}
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
