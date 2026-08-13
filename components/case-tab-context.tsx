'use client'

/**
 * Go-live round 2, item 3 — lets content INSIDE a tab pane switch the active
 * tab (the locked card's "Zu den Dokumenten" button lives inside the chat
 * pane, which page.tsx — a Server Component — slots into CaseTabs, so a plain
 * callback prop cannot reach it).
 *
 * CaseTabs provides its setTab; consumers get null when no provider exists —
 * i.e. the no-documents safety branch, where chat renders WITHOUT CaseTabs
 * (case-tabs.tsx) and there is no Dokumente pane to switch to. Callers must
 * hide their trigger on null.
 */

import { createContext, useContext } from 'react'

export type CaseTab = 'questions' | 'documents'

export const CaseTabSwitchContext = createContext<((tab: CaseTab) => void) | null>(null)

export function useCaseTabSwitch(): ((tab: CaseTab) => void) | null {
  return useContext(CaseTabSwitchContext)
}
