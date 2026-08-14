'use client'

/**
 * Go-live round 2, item 3 — lets content INSIDE a tab pane switch the active
 * tab (the locked card's "Zu den Dokumenten" button lives inside the chat
 * pane, which page.tsx — a Server Component — slots into CaseTabs, so a plain
 * callback prop cannot reach it).
 *
 * CaseTabs provides its setTab; consumers get null in the no-documents safety
 * branch, where there is no Unterlagen pane to switch to. Callers must hide
 * their trigger on null. (R2-1: that branch now stays inside the provider and
 * passes null explicitly, so the shell — sidebar included — renders in every
 * branch; before, it returned early without a provider.)
 */

import { createContext, useContext } from 'react'

export type CaseTab = 'questions' | 'documents'

export const CaseTabSwitchContext = createContext<((tab: CaseTab) => void) | null>(null)

export function useCaseTabSwitch(): ((tab: CaseTab) => void) | null {
  return useContext(CaseTabSwitchContext)
}
