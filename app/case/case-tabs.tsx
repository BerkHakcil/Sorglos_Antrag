'use client'

/**
 * Feedback pass item 2 — "Fragen | Dokumente" tab switcher, visible from first
 * login (the document checklist is no longer completion-gated). Both panes stay
 * MOUNTED (CSS hidden toggling) so ChatView's local state, scroll position and
 * auto-scroll survive tab switches. The badge is the missing-documents count
 * (server-computed; updates via router.refresh() on answer save and upload).
 * Without a documents pane (no rules and no default office — safety branch)
 * the chat renders alone, tab bar and all.
 */

import { useState, type ReactNode } from 'react'
import { de } from '@/lib/strings/de'
import { focusRing } from '@/components/ui/styles'

const t = de.case.tabs

export function CaseTabs({
  chat,
  documents,
  missing,
}: {
  chat: ReactNode
  documents: ReactNode | null
  missing: number
}) {
  const [tab, setTab] = useState<'questions' | 'documents'>('questions')
  if (!documents) return <div className="flex-1 overflow-hidden">{chat}</div>

  // E-2: the mockup marks the active tab with petrol TEXT plus a short
  // petrol underline inset from the label, rather than a full-width bottom
  // border. Colour alone would not be enough (WCAG 1.4.1) — the underline is
  // the non-colour cue, and aria-selected already carries it for AT.
  const tabClass = (active: boolean) =>
    `relative flex items-center gap-2 rounded-t-lg px-4 py-3 text-base font-medium transition-colors ${focusRing} ${
      active ? 'text-primary' : 'text-graphite-soft hover:text-foreground'
    }`

  const underlineClass = (active: boolean) =>
    `pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all ${
      active ? 'bg-primary' : 'bg-transparent'
    }`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-border/60 bg-background/95 shrink-0 border-b backdrop-blur">
        <div className="mx-auto flex max-w-2xl px-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'questions'}
            data-testid="tab-questions"
            className={tabClass(tab === 'questions')}
            onClick={() => setTab('questions')}
          >
            {t.questions}
            <span aria-hidden className={underlineClass(tab === 'questions')} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'documents'}
            data-testid="tab-documents"
            className={tabClass(tab === 'documents')}
            onClick={() => setTab('documents')}
          >
            {t.documents}
            {missing > 0 && (
              /* E-2: the mockup writes this as "· 4 offen" in soft graphite
                 rather than a filled pill.
                 Two deliberate deviations:
                 1. The separator is its own aria-hidden span OUTSIDE the
                    testid element. `feedback-pass.spec.ts` reads this badge
                    with Number(textContent), so folding "·" into the tagged
                    element would yield NaN and fail the count assertion.
                 2. The mockup's trailing word "offen" is NEW German copy and
                    would need Roman's authorship (R3), so it is not added —
                    the bare count is what we already ship. */
              <span className="text-graphite-soft/80 text-sm font-normal">
                <span aria-hidden>· </span>
                <span data-testid="docs-tab-badge">{missing}</span>
              </span>
            )}
            <span aria-hidden className={underlineClass(tab === 'documents')} />
          </button>
        </div>
      </div>
      <div className={tab === 'questions' ? 'flex-1 overflow-hidden' : 'hidden'}>{chat}</div>
      <div className={tab === 'documents' ? 'bg-muted/40 flex-1 overflow-y-auto' : 'hidden'}>
        <div className="mx-auto max-w-2xl px-4 py-4">{documents}</div>
      </div>
    </div>
  )
}
