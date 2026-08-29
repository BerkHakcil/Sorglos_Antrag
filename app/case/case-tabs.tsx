'use client'

/**
 * The case shell + its two panes ("Angaben | Unterlagen").
 *
 * Feedback pass item 2 introduced the tab switcher, visible from first login
 * (the document checklist is no longer completion-gated). Both panes stay
 * MOUNTED (CSS hidden toggling) so ChatView's local state, scroll position and
 * auto-scroll survive tab switches. The badge is the missing-documents count
 * (server-computed; updates via router.refresh() on answer save and upload).
 * Without a documents pane (no rules and no default office — safety branch)
 * the chat renders alone.
 *
 * ── UI round 2 / R2-1: this component owns the shell chrome ────────────────
 * D1 adopts the mockup's desktop sidebar, which is a NAV — so it must live in
 * the same state scope as the tab it switches. From `lg` (1024px) the shell is
 * a row: a sage sidebar carrying the brand mark, the nav pills and the
 * Hilfe/Abmelden/legal block, beside the pane column.
 *
 * ── Mobile round 3 / R1+R2+R3+R4 (GATE 1 APPROVED 2026-08-27) ──────────────
 * BELOW `lg` the shell now follows the round-3 mockup, a founder-confirmed
 * REVERSAL of UI-round-2 decision D2 (which had kept top-bar + underline
 * tabs). Top to bottom: a top bar with the burger menu (R2, `mobileMenu`
 * prop — server-rendered content, see page.tsx) and the applicant-name title
 * (R1); the per-tab subheader line (R3 = Roman's patient-banner row verbatim
 * on Angaben, R9's docs row on Unterlagen); and the Angaben/Unterlagen PILL
 * buttons (R4 — same treatment as the desktop sidebar pills). The old
 * underline tab row and the in-scroller title/intro copies are gone: title
 * and intro live in the pinned chrome now, said once.
 *
 * ⚠ HEIGHT BUDGET (the 2026-08-11 field bug's constraint): every pinned
 * pixel above the answer footer comes out of the footer's share of the
 * h-dvh column at 667px viewports. The round-3 chrome (subheader + pills)
 * is deliberately compact, and the multiselect option-list cap in
 * question-renderer.tsx was re-derived against it — mobile-footer.spec.ts
 * is the verification for both.
 *
 * The server-rendered chrome (logo, tagline, HelpSheet, the logout form, the
 * legal footer, the burger-menu content) arrives as ReactNode props rather
 * than being rebuilt here: this is a Client Component, and those parts must
 * keep rendering on the server (the logout form posts to a Server Action).
 *
 * Both nav instances — sidebar pills and mobile pill row — are mounted at all
 * times, one hidden by CSS. That is why R2-0 put `:visible` on every spec
 * read of `tab-questions` / `tab-documents` / `docs-tab-badge`.
 */

import { useState, type ReactNode } from 'react'
import { Pencil, FileText } from 'lucide-react'
import { de } from '@/lib/strings/de'
import { focusRing } from '@/components/ui/styles'
import { CaseTabSwitchContext } from '@/components/case-tab-context'

const t = de.case.tabs

type TabKey = 'questions' | 'documents'

/**
 * The "· n offen" count. Rendered at FULL opacity in both instances: the
 * shipped `/80` measured 3.72:1 on cream — an AA miss that predates this
 * round (Phase-1 §5.3). At full strength it is graphite-soft on the page or
 * on an inactive pill (>= 6.25:1, R8 values re-measured 2026-08-27) and
 * white on the copper pill (4.62:1).
 *
 * The separator and the word "offen" live in their own spans OUTSIDE the
 * testid element on purpose: `feedback-pass.spec.ts` reads this badge with
 * Number(textContent), so folding either into the tagged element would yield
 * NaN. D7 preserves that contract in the relocated instance.
 */
function DocsBadge({ missing, tone }: { missing: number; tone: 'muted' | 'onCopper' }) {
  if (missing <= 0) return null
  return (
    /* whitespace-nowrap: on the narrow mobile pill the badge must wrap as ONE
       unit onto its own line ("· 7 offen"), never split mid-badge ("· 7" /
       "offen" — the round-3 visual check caught exactly that). */
    <span
      className={`text-sm font-normal whitespace-nowrap ${tone === 'onCopper' ? 'text-white' : 'text-graphite-soft'}`}
    >
      <span aria-hidden>· </span>
      <span data-testid="docs-tab-badge">{missing}</span>
      <span> {t.badgeOpenWord}</span>
    </span>
  )
}

export function CaseTabs({
  chat,
  documents,
  missing,
  sidebarTop,
  sidebarBottom,
  mobileMenu,
  headerTitle,
  introQuestions,
  introDocuments,
}: {
  chat: ReactNode
  documents: ReactNode | null
  missing: number
  /** Brand mark + tagline, server-rendered (sidebar head). */
  sidebarTop?: ReactNode
  /** Hilfe / Abmelden / legal links, server-rendered (sidebar foot). */
  sidebarBottom?: ReactNode
  /** R2 (mobile round 3): the burger menu — trigger + dialog with
   *  server-rendered content. Shown in the mobile top bar only. */
  mobileMenu?: ReactNode
  /** R2-2 (D3): "Antrag für {Vorname} {Nachname}", or the standing fallback. */
  headerTitle?: string
  /** Intro line under the title, per pane (R2-2 / R3 / R9). '' hides it. */
  introQuestions?: string
  introDocuments?: string
}) {
  const [tab, setTab] = useState<TabKey>('questions')

  const items = [
    { key: 'questions' as const, label: t.questions, Icon: Pencil, testid: 'tab-questions' },
    { key: 'documents' as const, label: t.documents, Icon: FileText, testid: 'tab-documents' },
  ]

  // ── Nav pill (desktop sidebar AND, since round 3, the mobile row) ─────────
  // Desktop: the R2 mockup treatment, unchanged — label left / icon right,
  // rounded-xl, active copper fill, inactive soft outlined tile.
  // `compact` (mobile) follows the U7/U9 drafts since 2026-08-29: label+icon
  // CENTERED as one group, rounded-lg (~8px per the drafts), inactive as a
  // solid white tile with a soft shadow instead of the outlined translucent
  // one. Gate answers on the drafts' deviations: min-h-11 STAYS (the drafts'
  // ~40px loses to the E-7 44px touch floor — visual fidelity yields), and
  // the docs badge STAYS (the drafts omit dynamic elements by convention).
  const pillClass = (active: boolean, compact = false) =>
    `flex items-center font-medium transition-colors ${
      compact
        ? 'min-h-11 justify-center gap-2 rounded-lg px-3 py-2 text-sm'
        : 'justify-between gap-2 rounded-xl px-4 py-3 text-base'
    } ${focusRing} ${
      active
        ? 'bg-copper text-white shadow-sm'
        : compact
          ? 'bg-card text-foreground shadow-sm hover:bg-cream'
          : 'border-sage/50 bg-background/60 text-foreground hover:bg-cream border'
    }`

  const sidebar = (
    <aside className="border-sage/40 bg-sage-soft/40 hidden shrink-0 flex-col justify-between overflow-y-auto border-r p-8 lg:flex lg:w-72 xl:w-80">
      <div className="flex flex-col gap-8">
        {sidebarTop}
        {documents && (
          <nav className="flex flex-col gap-2" role="tablist" aria-orientation="vertical">
            {items.map(({ key, label, Icon, testid }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={testid}
                  className={pillClass(active)}
                  onClick={() => setTab(key)}
                >
                  {/* inline-flex + gap: label and badge share one inline box,
                      which would render "Unterlagen· 3 offen" without it. */}
                  <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                    {label}
                    {key === 'documents' && (
                      <DocsBadge missing={missing} tone={active ? 'onCopper' : 'muted'} />
                    )}
                  </span>
                  <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
                </button>
              )
            })}
          </nav>
        )}
      </div>
      {sidebarBottom}
    </aside>
  )

  /* Item 3 (go-live round 2): the provider lets pane content switch tabs —
     the locked card's "Zu den Dokumenten" button lives inside the chat pane.
     The no-documents branch passes null so consumers hide their trigger
     (there is no pane to switch to). */
  /* R2-2 (D3): title + intro sit in the SHELL, above both panes. The intro
     switches with the tab because the two panes ask for different things.
     Both strings are DB-authored and '' -degrade, so a missing row renders
     nothing rather than an empty line.

     The progress bar deliberately stays inside the Angaben pane instead of
     joining this block: its percentage is derived from ChatView's live client
     state, and it counts QUESTIONS only. (The Unterlagen pane got its own
     upload-progress bar in round 3 — computed in DocumentArea from the same
     slots/uploads the counter uses, gate answer 3.) */
  const intro = tab === 'documents' && documents ? introDocuments : introQuestions

  /* Desktop pinned copy (`hidden lg:block`) — unchanged in round 3; the
     mobile chrome below carries the title/intro below lg. No border on
     purpose: the Angaben pane's own band (progress) sits directly beneath,
     and two stacked rules read as two chrome regions where the mockup has
     one. */
  const header = (headerTitle || intro) && (
    <div className="bg-background/95 hidden shrink-0 backdrop-blur lg:block">
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-3 lg:text-center">
        {headerTitle && (
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            {headerTitle}
          </h1>
        )}
        {intro && (
          <p className="text-graphite-soft mt-2 text-sm leading-relaxed lg:mx-auto lg:max-w-md">
            {intro}
          </p>
        )}
      </div>
    </div>
  )

  /* ── Mobile chrome (below lg): ONE sage panel (U9, GATE 1 2026-08-29) ────
     The round-3 two-band cream chrome became the drafts' single sage-soft
     panel: burger + applicant name (R1/R2) over a full-bleed hairline, then
     the per-tab intro line (R3/R9) and the button nav (R4/U7) on the same
     panel. The panel has NO bottom border — on the Angaben tab ChatView's
     progress band continues it seamlessly (same bg, chat-view.tsx) and ends
     it; on Unterlagen it ends here, against the pane background. Every row
     is PINNED height taken from the answer footer's budget at 667px
     (mobile-footer.spec verifies): the drafts' generous vertical air was
     deliberately tightened to the shipped rhythm for the same reason their
     40px buttons lost to the 44px floor — only the side inset (~px-7)
     follows the drafts (gate answer 6b). */
  const mobileChrome = (
    <div className="bg-sage-soft shrink-0 lg:hidden">
      <div className="border-border/60 border-b">
        <div className="mx-auto flex min-w-0 max-w-2xl items-center gap-3 px-4 py-1.5">
          {mobileMenu}
          {headerTitle && (
            <h1 className="text-foreground min-w-0 truncate text-xl font-bold tracking-tight">
              {headerTitle}
            </h1>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-7">
        {intro && <p className="text-graphite-soft pt-3 pb-2 text-[15px] leading-snug">{intro}</p>}
        {documents && (
          <div className="grid grid-cols-2 gap-3.5 pb-3" role="tablist">
            {items.map(({ key, label, Icon, testid }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={testid}
                  className={pillClass(active, true)}
                  onClick={() => setTab(key)}
                >
                  <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                    {label}
                    {key === 'documents' && (
                      <DocsBadge missing={missing} tone={active ? 'onCopper' : 'muted'} />
                    )}
                  </span>
                  <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <CaseTabSwitchContext.Provider value={documents ? setTab : null}>
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {mobileChrome}
          {header}
          <div className={tab === 'questions' || !documents ? 'flex-1 overflow-hidden' : 'hidden'}>
            {chat}
          </div>
          {documents && (
            <div className={tab === 'documents' ? 'bg-muted/40 flex-1 overflow-y-auto' : 'hidden'}>
              <div className="mx-auto max-w-2xl px-4 py-4">
                {/* Round 3: the mobile in-scroller title/intro copy is gone —
                    the pinned chrome above says it once (R1/R9). */}
                {documents}
              </div>
            </div>
          )}
        </div>
      </div>
    </CaseTabSwitchContext.Provider>
  )
}
