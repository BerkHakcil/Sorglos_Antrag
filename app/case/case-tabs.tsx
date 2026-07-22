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

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
      active
        ? 'border-primary text-foreground'
        : 'text-muted-foreground hover:text-foreground border-transparent'
    }`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-border bg-card shrink-0 border-b">
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
              <span
                data-testid="docs-tab-badge"
                className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold"
              >
                {missing}
              </span>
            )}
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
