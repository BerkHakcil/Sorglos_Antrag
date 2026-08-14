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
 * ── UI round 2 / R2-1: this component now owns the shell chrome too ────────
 * D1 adopts the mockup's desktop sidebar, which is a NAV — so it must live in
 * the same state scope as the tab it switches. From `lg` (1024px, D2) the
 * shell is a row: a sage sidebar carrying the brand mark, the nav pills and
 * the Hilfe/Abmelden/legal block, beside the pane column. BELOW `lg` nothing
 * about the layout changes — the proven top-bar + tab-row + bottom-footer
 * arrangement is untouched, including the flex chain the mobile answer-footer
 * depends on (the 2026-08-11 field bug must stay dead).
 *
 * The server-rendered chrome (logo, tagline, HelpSheet, the logout form, the
 * legal footer) arrives as ReactNode props rather than being rebuilt here:
 * this is a Client Component, and those parts must keep rendering on the
 * server (the logout form posts to a Server Action).
 *
 * Both nav instances — sidebar pills and mobile tab row — are mounted at all
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
 * on an inactive pill (>= 5.09:1) and white on the copper pill (4.69:1).
 *
 * The separator and the word "offen" live in their own spans OUTSIDE the
 * testid element on purpose: `feedback-pass.spec.ts` reads this badge with
 * Number(textContent), so folding either into the tagged element would yield
 * NaN. D7 preserves that contract in the relocated instance.
 */
function DocsBadge({ missing, tone }: { missing: number; tone: 'muted' | 'onCopper' }) {
  if (missing <= 0) return null
  return (
    <span
      className={`text-sm font-normal ${tone === 'onCopper' ? 'text-white' : 'text-graphite-soft'}`}
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
  /** R2-2 (D3): "Antrag für {Vorname} {Nachname}", or the standing fallback. */
  headerTitle?: string
  /** Intro line under the title, per pane (R2-2). '' hides it. */
  introQuestions?: string
  introDocuments?: string
}) {
  const [tab, setTab] = useState<TabKey>('questions')

  const items = [
    { key: 'questions' as const, label: t.questions, Icon: Pencil, testid: 'tab-questions' },
    { key: 'documents' as const, label: t.documents, Icon: FileText, testid: 'tab-documents' },
  ]

  // ── Sidebar nav pill (desktop) ────────────────────────────────────────────
  // Mockup treatment: active = copper fill + white text (4.69:1); inactive =
  // a soft outlined tile. The pill is a real tab control, not a link — no
  // routing comes across from the mockup.
  const pillClass = (active: boolean) =>
    `flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-base font-medium transition-colors ${focusRing} ${
      active
        ? 'bg-copper text-white shadow-sm'
        : 'border-sage/50 bg-background/60 text-foreground hover:bg-cream border'
    }`

  // ── Mobile tab (below lg) — unchanged from the shipped E-2 treatment ──────
  // The active tab is marked with petrol TEXT plus a short petrol underline
  // inset from the label, rather than a full-width bottom border. Colour alone
  // would not be enough (WCAG 1.4.1) — the underline is the non-colour cue,
  // and aria-selected already carries it for AT.
  const tabClass = (active: boolean) =>
    `relative flex items-center gap-2 rounded-t-lg px-4 py-3 text-base font-medium transition-colors ${focusRing} ${
      active ? 'text-primary' : 'text-graphite-soft hover:text-foreground'
    }`

  const underlineClass = (active: boolean) =>
    `pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all ${
      active ? 'bg-primary' : 'bg-transparent'
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
                  {/* inline-flex + gap: the mobile tab gets this spacing from
                      the button's own flex row, but here label and badge share
                      one inline box, which would render "Unterlagen· 3 offen". */}
                  <span className="inline-flex items-baseline gap-1.5">
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
  /* R2-2 (D3): title + intro sit in the SHELL, above both panes, as in the
     mockup — one heading for the case rather than a per-pane subheading. The
     intro switches with the tab because the two panes ask for different things.
     Both strings are DB-authored and '' -degrade, so a missing row renders
     nothing rather than an empty line.

     The progress bar deliberately stays inside the Angaben pane instead of
     joining this block: its percentage is derived from ChatView's live client
     state, and it counts QUESTIONS only — the mockup's bar folds document
     uploads into the same number, so showing it above the Unterlagen tab would
     claim a completeness we do not measure. */
  const intro = tab === 'documents' && documents ? introDocuments : introQuestions
  /* PINNED COPY — DESKTOP ONLY (`hidden lg:block`). This block is fixed height
     above the panes, and on mobile that height comes straight out of the
     answer footer's share of an h-dvh column: the first attempt put the save
     button 702px down a 667px viewport and mobile-footer.spec caught it — the
     2026-08-11 field bug, re-created. Below lg the same title and intro render
     INSIDE each pane's scroller instead (see the `mobileHeader` copies), which
     is exactly how the patient banner it replaces always behaved.

     No border on purpose: the Angaben pane's own band (progress) sits directly
     beneath, and two stacked rules read as two chrome regions where the mockup
     has one. */
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

  return (
    <CaseTabSwitchContext.Provider value={documents ? setTab : null}>
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {header}
          {documents && (
            <div className="border-border/60 bg-background/95 shrink-0 border-b backdrop-blur lg:hidden">
              <div className="mx-auto flex max-w-2xl px-4" role="tablist">
                {items.map(({ key, label, testid }) => {
                  const active = tab === key
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={testid}
                      className={tabClass(active)}
                      onClick={() => setTab(key)}
                    >
                      {label}
                      {key === 'documents' && <DocsBadge missing={missing} tone="muted" />}
                      <span aria-hidden className={underlineClass(active)} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className={tab === 'questions' || !documents ? 'flex-1 overflow-hidden' : 'hidden'}>
            {chat}
          </div>
          {documents && (
            <div className={tab === 'documents' ? 'bg-muted/40 flex-1 overflow-y-auto' : 'hidden'}>
              <div className="mx-auto max-w-2xl px-4 py-4">
                {/* Mobile copy of the shell header — inside the scroller, so it
                    costs the pane no fixed height (see the pinned copy above). */}
                {(headerTitle || introDocuments) && (
                  <div className="mb-4 lg:hidden">
                    {headerTitle && (
                      <h1 className="text-foreground text-xl font-bold tracking-tight">
                        {headerTitle}
                      </h1>
                    )}
                    {introDocuments && (
                      <p className="text-graphite-soft mt-2 text-sm leading-relaxed">
                        {introDocuments}
                      </p>
                    )}
                  </div>
                )}
                {documents}
              </div>
            </div>
          )}
        </div>
      </div>
    </CaseTabSwitchContext.Provider>
  )
}
