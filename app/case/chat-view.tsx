'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import {
  buildNav,
  formatAnswerForDisplay,
  type NavQuestion,
  type NavState,
  type GroupPromptInfo,
  type LoadedQuestionnaire,
} from '@/lib/questionnaire-nav'
import { QuestionRenderer } from '@/components/ui/questionnaire/question-renderer'
import { saveAnswerAction, deleteGroupInstanceAction } from './actions'
import { de } from '@/lib/strings/de'

const s = de.case.chat
const sc = de.case
const sq = de.case.questionnaire

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  questionnaire: LoadedQuestionnaire
  initialAnswersMap: Record<string, unknown>
  initialGroupInstances: Record<string, string[]>
  initialGroupAnswers: Record<string, Record<string, unknown>>
  caseStatus: string
  caseId: string
  plzBeforeMove: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyValueFor(answerType: string): unknown {
  switch (answerType) {
    case 'address':      return { street: '', plz: '', city: '' }
    case 'person':       return { first_name: '', last_name: '', birth_date: '' }
    case 'bank_account': return { iban: '', bic: '', bank_name: '' }
    case 'multi_select': return []
    default:             return ''
  }
}

/** Compound key used for answerDrafts, draftErrors, and skippedIds for group questions. */
function draftKey(qId: string, instanceId: string | null): string {
  return instanceId ? `${qId}:${instanceId}` : qId
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ nav }: { nav: NavState }) {
  const label = s.progressLabel
    .replace('{answered}', String(nav.answeredRequired))
    .replace('{total}', String(nav.totalRequired))

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{nav.progressPercent}%</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${nav.progressPercent}%` }}
        />
      </div>
    </div>
  )
}

function AnsweredBubble({
  question,
  prevQuestion,
  onEdit,
  onRemoveInstance,
  isEditing,
  locked,
}: {
  question: NavQuestion
  prevQuestion?: NavQuestion
  onEdit: (q: NavQuestion) => void
  onRemoveInstance: (groupKey: string, instanceId: string) => void
  isEditing: boolean
  locked: boolean
}) {
  const isNewInstance =
    question.instanceId !== null &&
    (prevQuestion?.instanceId !== question.instanceId ||
      prevQuestion?.categoryId !== question.categoryId)

  const showSectionHeader =
    !prevQuestion ||
    prevQuestion.categoryId !== question.categoryId ||
    isNewInstance

  const sectionLabel =
    question.instanceId && question.instanceIndex > 0
      ? s.repeatableGroup.instanceLabel
          .replace('{group}', question.group_label_de ?? question.categoryLabel)
          .replace('{index}', String(question.instanceIndex))
      : question.categoryLabel

  const displayValue = formatAnswerForDisplay(question, question.savedValue)

  return (
    <>
      {showSectionHeader && (
        <div className="border-border flex items-center justify-between border-b pb-1 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sectionLabel}
          </h3>
          {!locked && question.instanceId && isNewInstance && question.instanceIndex > 1 && (
            <button
              type="button"
              onClick={() => onRemoveInstance(question.group_key!, question.instanceId!)}
              className="text-muted-foreground hover:text-destructive text-xs underline underline-offset-2"
            >
              {s.repeatableGroup.removeInstanceLabel}
            </button>
          )}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{question.prompt_de}</p>
        <div className="flex items-start gap-2">
          <div
            className={`bg-primary/10 inline-block max-w-full rounded-lg px-3 py-2 text-sm ${
              isEditing ? 'ring-primary ring-2 ring-offset-1' : ''
            }`}
          >
            {displayValue}
          </div>
          {!locked && (
            <button
              type="button"
              onClick={() => onEdit(question)}
              className="text-muted-foreground hover:text-foreground mt-1 shrink-0 text-xs underline underline-offset-2"
            >
              {s.editButton}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function CurrentQuestionCard({
  question,
  value,
  onChange,
  error,
  saving,
  onSave,
  onSkip,
  onCancel,
  isEditMode,
  isReask,
  showCategoryHeader,
}: {
  question: NavQuestion
  value: unknown
  onChange: (v: unknown) => void
  error: string | null
  saving: boolean
  onSave: () => void
  onSkip?: () => void
  onCancel?: () => void
  isEditMode?: boolean
  isReask?: boolean
  showCategoryHeader?: boolean
}) {
  const sectionLabel =
    question.instanceId && question.instanceIndex > 0
      ? s.repeatableGroup.instanceLabel
          .replace('{group}', question.group_label_de ?? question.categoryLabel)
          .replace('{index}', String(question.instanceIndex))
      : question.categoryLabel

  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm space-y-4">
      {showCategoryHeader !== false && (
        <div className="border-border border-b pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sectionLabel}
          </h3>
        </div>
      )}

      {isReask && (
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-700 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">{s.reaskNote}</p>
        </div>
      )}

      <QuestionRenderer
        question={question}
        value={value}
        onChange={onChange}
        onSubmit={onSave}
      />

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? s.savingButton : isEditMode ? s.editSaveButton : s.nextButton}
        </button>

        {onCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground border-border rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            {s.editCancelButton}
          </button>
        )}

        {onSkip && !isEditMode && !isReask && (
          <button
            type="button"
            disabled={saving}
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground border-border rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            {s.skipButton}
          </button>
        )}
      </div>
    </div>
  )
}

function GroupPromptCard({
  prompt,
  onYes,
  onNo,
  saving,
}: {
  prompt: GroupPromptInfo
  onYes: () => void
  onNo: () => void
  saving: boolean
}) {
  const question = s.repeatableGroup.anotherPrompt.replace('{group}', prompt.groupLabelDe)
  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm space-y-4">
      <p className="text-sm font-medium">{question}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onYes}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {s.repeatableGroup.yesButton}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onNo}
          className="text-muted-foreground hover:text-foreground border-border rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          {s.repeatableGroup.noButton}
        </button>
      </div>
    </div>
  )
}

function AllAnsweredCard() {
  return (
    <div className="space-y-2 py-2 text-center">
      <p className="text-sm font-semibold">{s.allAnsweredHeading}</p>
      <p className="text-muted-foreground text-sm">{s.allAnsweredMessage}</p>
    </div>
  )
}

function EditLockedCard() {
  return (
    <p className="text-center text-muted-foreground text-sm py-2">{s.editLockedMessage}</p>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

export function ChatView({
  questionnaire,
  initialAnswersMap,
  initialGroupInstances,
  initialGroupAnswers,
  caseStatus,
  caseId,
  plzBeforeMove,
}: Props) {
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>(initialAnswersMap)

  // groupInstances: groupKey → ordered list of stable instance UUIDs
  const [groupInstances, setGroupInstances] = useState<Record<string, string[]>>(initialGroupInstances)
  // groupAnswers: instanceId → { questionKey → value }
  const [groupAnswers, setGroupAnswers] = useState<Record<string, Record<string, unknown>>>(initialGroupAnswers)
  // dismissedGroups: groupKeys where user clicked "Nein" this session
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(new Set())

  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  // Per-question draft values keyed by draftKey(qId, instanceId)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, unknown>>({})
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({})
  // null = normal flow; set to a question ID when editing an answered question
  const [editingId, setEditingId] = useState<string | null>(null)
  // For group questions, also track the instance being edited
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Ref for the scrollable history container — scrolled to bottom when new answers arrive
  const historyRef = useRef<HTMLDivElement>(null)

  const nav = useMemo(
    () => buildNav(questionnaire, answersMap, groupInstances, groupAnswers, dismissedGroups, skippedIds),
    [questionnaire, answersMap, groupInstances, groupAnswers, dismissedGroups, skippedIds],
  )

  const isLocked = caseStatus === 'under_review'

  // ── Live status label derived from nav + caseStatus ────────────────────────
  const derivedStatusLabel: string =
    caseStatus === 'under_review'
      ? (sc.statusLabels['under_review'] ?? caseStatus)
      : nav.allRequiredAnswered
      ? (sc.statusLabels['completed'] ?? caseStatus)
      : (sc.statusLabels['in_progress'] ?? caseStatus)

  const statusClass =
    caseStatus === 'under_review'
      ? 'text-blue-600 dark:text-blue-400'
      : nav.allRequiredAnswered
      ? 'text-green-600 dark:text-green-400'
      : 'text-muted-foreground'

  // ── Resolve the currently active question ──────────────────────────────────
  const editingQ = editingId
    ? nav.flatVisible.find((q) => q.id === editingId && q.instanceId === editingInstanceId) ?? null
    : null
  const isReaskingSkipped = !editingId && !nav.nextQuestion && !!nav.nextSkippedQuestion
  const activeQ: NavQuestion | null =
    editingQ ?? nav.nextQuestion ?? (isReaskingSkipped ? (nav.nextSkippedQuestion ?? null) : null)

  const dk = activeQ ? draftKey(activeQ.id, activeQ.instanceId) : null
  const currentValue: unknown = activeQ
    ? (dk !== null ? (answerDrafts[dk] ?? emptyValueFor(activeQ.answer_type)) : emptyValueFor(activeQ.answer_type))
    : null
  const validationError = activeQ ? (draftErrors[draftKey(activeQ.id, activeQ.instanceId)] ?? null) : null

  const answeredQuestions = nav.flatVisible.filter((q) => q.isAnswered)
  const answeredCount = answeredQuestions.length

  // Scroll history to bottom whenever a new answer lands
  useEffect(() => {
    const el = historyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [answeredCount])

  // ── Category header: show only when entering a new category/instance ───────
  const lastAnsweredQ = answeredQuestions[answeredQuestions.length - 1] ?? null
  const showCatHeader: boolean = !activeQ
    ? false
    : !lastAnsweredQ ||
      lastAnsweredQ.categoryId !== activeQ.categoryId ||
      lastAnsweredQ.instanceId !== activeQ.instanceId

  // ── Event handlers ─────────────────────────────────────────────────────────

  const startEditing = (q: NavQuestion) => {
    setEditingId(q.id)
    setEditingInstanceId(q.instanceId)
    const dk2 = draftKey(q.id, q.instanceId)
    const savedVal = q.instanceId
      ? ((groupAnswers[q.instanceId] ?? {})[q.key] ?? null)
      : q.savedValue
    setAnswerDrafts((prev) => ({
      ...prev,
      [dk2]: prev[dk2] !== undefined ? prev[dk2] : savedVal,
    }))
    setDraftErrors((prev) => { const n = { ...prev }; delete n[dk2]; return n })
  }

  const cancelEdit = () => {
    if (!editingId) return
    const id = editingId
    const iid = editingInstanceId
    setEditingId(null)
    setEditingInstanceId(null)
    const dk2 = draftKey(id, iid)
    setAnswerDrafts((prev) => { const n = { ...prev }; delete n[dk2]; return n })
    setDraftErrors((prev) => { const n = { ...prev }; delete n[dk2]; return n })
  }

  const handleChange = (v: unknown) => {
    if (!activeQ) return
    setAnswerDrafts((prev) => ({ ...prev, [draftKey(activeQ.id, activeQ.instanceId)]: v }))
  }

  const handleSave = () => {
    if (!activeQ || isPending) return

    const qId = activeQ.id
    const qKey = activeQ.key
    const instanceId = activeQ.instanceId
    const value = currentValue
    const dk2 = draftKey(qId, instanceId)
    const wasEditing = editingId

    if (instanceId) {
      // ── Group question save ───────────────────────────────────────────────
      const prevGroupValue = (groupAnswers[instanceId] ?? {})[qKey]

      setGroupAnswers((prev) => ({
        ...prev,
        [instanceId]: { ...(prev[instanceId] ?? {}), [qKey]: value },
      }))
      if (wasEditing) { setEditingId(null); setEditingInstanceId(null) }
      setAnswerDrafts((prev) => { const n = { ...prev }; delete n[dk2]; return n })
      setDraftErrors((prev) => { const n = { ...prev }; delete n[dk2]; return n })

      startTransition(async () => {
        const result = await saveAnswerAction({ questionId: qId, groupInstance: instanceId, value })
        if (!result.ok) {
          setGroupAnswers((prev) => {
            const inst = { ...(prev[instanceId] ?? {}) }
            if (prevGroupValue === undefined) delete inst[qKey]
            else inst[qKey] = prevGroupValue
            return { ...prev, [instanceId]: inst }
          })
          if (wasEditing) { setEditingId(qId); setEditingInstanceId(instanceId) }
          setAnswerDrafts((prev) => ({ ...prev, [dk2]: value }))
          setDraftErrors((prev) => ({ ...prev, [dk2]: result.error }))
        }
      })
    } else {
      // ── Non-group question save ───────────────────────────────────────────
      const prevValue = answersMap[qKey]

      setAnswersMap((prev) => ({ ...prev, [qKey]: value }))
      if (wasEditing) { setEditingId(null); setEditingInstanceId(null) }
      setAnswerDrafts((prev) => { const n = { ...prev }; delete n[dk2]; return n })
      setDraftErrors((prev) => { const n = { ...prev }; delete n[dk2]; return n })

      startTransition(async () => {
        const result = await saveAnswerAction({ questionId: qId, groupInstance: 'default', value })
        if (!result.ok) {
          setAnswersMap((prev) => {
            if (prevValue === undefined) { const n = { ...prev }; delete n[qKey]; return n }
            return { ...prev, [qKey]: prevValue }
          })
          if (wasEditing) { setEditingId(qId); setEditingInstanceId(null) }
          setAnswerDrafts((prev) => ({ ...prev, [dk2]: value }))
          setDraftErrors((prev) => ({ ...prev, [dk2]: result.error }))
        }
      })
    }
  }

  const handleSkip = () => {
    // Skipping is not supported for group questions (no stable per-instance skip state)
    if (!activeQ || isPending || isReaskingSkipped || activeQ.instanceId !== null) return
    setSkippedIds((prev) => new Set([...prev, draftKey(activeQ.id, null)]))
    setAnswerDrafts((prev) => { const n = { ...prev }; delete n[draftKey(activeQ.id, null)]; return n })
    setDraftErrors((prev) => { const n = { ...prev }; delete n[draftKey(activeQ.id, null)]; return n })
  }

  const handleGroupYes = (groupKey: string) => {
    const newInstanceId = crypto.randomUUID()
    setGroupInstances((prev) => ({
      ...prev,
      [groupKey]: [...(prev[groupKey] ?? []), newInstanceId],
    }))
    // Dismissal is cleared when a new instance is added
    setDismissedGroups((prev) => {
      const n = new Set(prev)
      n.delete(groupKey)
      return n
    })
  }

  const handleGroupNo = (groupKey: string) => {
    setDismissedGroups((prev) => new Set([...prev, groupKey]))
  }

  const handleDeleteInstance = (groupKey: string, instanceId: string) => {
    setGroupInstances((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] ?? []).filter((id) => id !== instanceId),
    }))
    setGroupAnswers((prev) => {
      const n = { ...prev }
      delete n[instanceId]
      return n
    })
    // Clear any drafts/errors for this instance
    setAnswerDrafts((prev) => {
      const n = { ...prev }
      Object.keys(n).forEach((k) => { if (k.endsWith(`:${instanceId}`)) delete n[k] })
      return n
    })
    // If dismissal was set for this group, clear it so prompt can reappear
    setDismissedGroups((prev) => {
      const n = new Set(prev)
      n.delete(groupKey)
      return n
    })

    startTransition(async () => {
      await deleteGroupInstanceAction({ groupKey, instanceId })
    })
  }

  // Show group prompt when the group is complete and not dismissed (no active edit)
  const showGroupPrompt = !isLocked && !!nav.groupPrompt && !editingId
  // Show current question card when no group prompt is blocking and there is an active question
  const showQuestionCard = !isLocked && !showGroupPrompt && !!activeQ
  const showAllDone = !isLocked && !editingId && nav.allRequiredAnswered && !nav.groupPrompt && !activeQ

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* ── Fixed top: subheader + progress bar ─────────────── */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-3 space-y-2">
          {/* Subheader: title + case meta + live status */}
          <div className="space-y-1">
            <h2 className="font-semibold text-sm">{sc.subheading}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{`${caseId.slice(0, 8)}…`}</span>
              {plzBeforeMove && <span>PLZ {plzBeforeMove}</span>}
              <span className={statusClass}>{derivedStatusLabel}</span>
            </div>
          </div>
          {/* Progress bar */}
          {nav.totalRequired > 0 && <ProgressBar nav={nav} />}
        </div>
      </div>

      {/* ── Scrollable middle: patient banner + answered history ─ */}
      <div ref={historyRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          {/* Patient notice */}
          <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {sq.patientBannerTitle}
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{sq.patientBannerBody}</p>
          </div>

          {/* Answered Q&A history */}
          {answeredQuestions.length > 0 && (
            <div className="space-y-3">
              {answeredQuestions.map((q, i) => (
                <AnsweredBubble
                  key={q.instanceId ? `${q.id}:${q.instanceId}` : q.id}
                  question={q}
                  prevQuestion={answeredQuestions[i - 1]}
                  onEdit={startEditing}
                  onRemoveInstance={handleDeleteInstance}
                  isEditing={editingId === q.id && editingInstanceId === q.instanceId}
                  locked={isLocked}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pinned bottom: action area ───────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {isLocked ? (
            <EditLockedCard />
          ) : showGroupPrompt && nav.groupPrompt ? (
            <GroupPromptCard
              prompt={nav.groupPrompt}
              onYes={() => handleGroupYes(nav.groupPrompt!.groupKey)}
              onNo={() => handleGroupNo(nav.groupPrompt!.groupKey)}
              saving={isPending}
            />
          ) : showQuestionCard && activeQ ? (
            <CurrentQuestionCard
              question={activeQ}
              value={currentValue}
              onChange={handleChange}
              error={validationError}
              saving={isPending}
              onSave={handleSave}
              onSkip={!editingId && activeQ.instanceId === null ? handleSkip : undefined}
              onCancel={editingId ? cancelEdit : undefined}
              isEditMode={!!editingId}
              isReask={isReaskingSkipped}
              showCategoryHeader={showCatHeader}
            />
          ) : showAllDone ? (
            <AllAnsweredCard />
          ) : null}
        </div>
      </div>
    </div>
  )
}
