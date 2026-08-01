/**
 * Repeatable-group instance derivation — pure, shared, single source of truth
 * (pass 4 / D15). Before this module, FOUR sites derived group instances
 * independently and would have drifted the moment count-driven rendering
 * landed: app/case/page.tsx (server render), app/case/actions.ts (the
 * completion gate), app/case/chat-view.tsx (client state adjustments via
 * capInstances) and scripts/case-export.mjs (ops export). All four now go
 * through here. Design of record: docs/feedback/pass4_phase_a.md §A1.3.
 *
 * Count-driven groups (`question_group.count_source_key` set — today only the
 * Berlin pension group, keyed on `pension_count`) render EXACTLY N instances,
 * where N is the saved answer to the count question:
 *   - stored instances are kept in FIRST-SEEN order (callers supply answer
 *     rows ordered by created_at — see getCaseAnswers) and truncated to N;
 *   - missing instances are topped up with fresh UUIDs;
 *   - count unanswered means N = 0: nothing renders, and the required count
 *     question itself blocks completion;
 *   - the add-another prompt is suppressed (questionnaire-nav) and instances
 *     beyond a DECREASED count leave flatVisible, where the existing
 *     stale-answer sweep deletes their rows (confirm-and-clear, the decided
 *     semantics — the UI confirms before saving the decrease).
 *
 * Classic repeatable groups keep their historical per-site behavior via
 * `mode`:
 *   'render'     — auto-create one empty instance for a group with none, so
 *                  the first instance's questions appear (page.tsx behavior).
 *   'completion' — use the zero-UUID placeholder instead, so buildNav counts
 *                  the unstarted group's required questions and completion
 *                  cannot fire early (actions.ts behavior). Count-driven
 *                  groups deliberately get NO placeholder: with count 0 there
 *                  is nothing to answer, and a placeholder would hold an
 *                  unanswerable required question — blocking completion
 *                  forever.
 *   'export'     — no fill at all: only instances that exist in the data
 *                  (case-export slot evaluation).
 */

import type { LoadedQuestionnaire } from './questionnaire-types'

export type DeriveMode = 'render' | 'completion' | 'export'

export type GroupData = {
  groupInstances: Record<string, string[]>
  groupAnswers: Record<string, Record<string, unknown>>
}

type AnswerRow = { question_id: string; group_instance: string; value: unknown }

const COMPLETION_PLACEHOLDER = '00000000-0000-0000-0000-000000000000'

/** Parses a count answer ("0".."8" as stored by the single_select). Anything
 *  non-numeric — unanswered, cleared, malformed — is 0: fail closed. */
export function parseCount(value: unknown): number {
  const n =
    typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Truncates/extends an instance list to exactly n (pure; makeId supplies new
 *  ids so callers control randomness — the client passes crypto.randomUUID). */
export function capInstances(list: string[], n: number, makeId: () => string): string[] {
  if (list.length > n) return list.slice(0, n)
  const out = [...list]
  while (out.length < n) out.push(makeId())
  return out
}

export function deriveGroupData(
  questionnaire: LoadedQuestionnaire,
  answersRaw: AnswerRow[],
  mode: DeriveMode
): GroupData {
  // question id → group membership; group key → count source (if any)
  const qToGroup: Record<string, { groupKey: string; questionKey: string }> = {}
  const countSourceByGroup: Record<string, string> = {}
  const repGroupKeys = new Set<string>()
  const keyById: Record<string, string> = {}
  for (const cat of questionnaire.categories) {
    for (const q of cat.questions) {
      keyById[q.id] = q.key
      if (q.group_key && q.group_is_repeatable) {
        qToGroup[q.id] = { groupKey: q.group_key, questionKey: q.key }
        repGroupKeys.add(q.group_key)
        if (q.group_count_source_key) countSourceByGroup[q.group_key] = q.group_count_source_key
      }
    }
  }

  const groupInstances: Record<string, string[]> = {}
  const groupAnswers: Record<string, Record<string, unknown>> = {}
  const defaults: Record<string, unknown> = {}

  // answersRaw is created_at-ordered (oldest first), so first-seen == oldest:
  // truncation on count decrease drops the NEWEST instances.
  for (const a of answersRaw) {
    if (a.group_instance === 'default') {
      const k = keyById[a.question_id]
      if (k) defaults[k] = a.value
      continue
    }
    const info = qToGroup[a.question_id]
    if (!info) continue
    const { groupKey, questionKey } = info
    if (!groupInstances[groupKey]) groupInstances[groupKey] = []
    if (!groupInstances[groupKey].includes(a.group_instance)) {
      groupInstances[groupKey].push(a.group_instance)
    }
    if (!groupAnswers[a.group_instance]) groupAnswers[a.group_instance] = {}
    groupAnswers[a.group_instance][questionKey] = a.value
  }

  for (const gk of repGroupKeys) {
    const countKey = countSourceByGroup[gk]
    if (countKey) {
      const n = parseCount(defaults[countKey])
      groupInstances[gk] = capInstances(groupInstances[gk] ?? [], n, () => crypto.randomUUID())
      continue
    }
    if ((groupInstances[gk] ?? []).length === 0) {
      if (mode === 'render') groupInstances[gk] = [crypto.randomUUID()]
      else if (mode === 'completion') groupInstances[gk] = [COMPLETION_PLACEHOLDER]
      else groupInstances[gk] = []
    }
  }

  return { groupInstances, groupAnswers }
}
