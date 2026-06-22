'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import {
  buildNav,
  formatAnswerForDisplay,
  type NavQuestion,
  type NavState,
  type LoadedQuestionnaire,
} from '@/lib/questionnaire-nav'
import { QuestionRenderer } from '@/components/ui/questionnaire/question-renderer'
import { saveAnswerAction } from './actions'
import { de } from '@/lib/strings/de'

const s = de.case.chat
const sq = de.case.questionnaire

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  questionnaire: LoadedQuestionnaire
  initialAnswersMap: Record<string, unknown>
  caseStatus: string
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
  isEditing,
  locked,
}: {
  question: NavQuestion
  prevQuestion?: NavQuestion
  onEdit: (q: NavQuestion) => void
  isEditing: boolean
  locked: boolean
}) {
  const showSectionHeader = !prevQuestion || prevQuestion.categoryId !== question.categoryId
  const displayValue = formatAnswerForDisplay(question, question.savedValue)

  return (
    <>
      {showSectionHeader && (
        <div className="border-border border-b pb-1 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {question.categoryLabel}
          </h3>
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
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm space-y-4">
      <div className="border-border border-b pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {question.categoryLabel}
        </h3>
      </div>

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

function AllAnsweredCard() {
  return (
    <div className="border-border bg-card rounded-xl border p-6 shadow-sm text-center space-y-2">
      <p className="text-base font-semibold">{s.allAnsweredHeading}</p>
      <p className="text-muted-foreground text-sm">{s.allAnsweredMessage}</p>
    </div>
  )
}

function EditLockedCard() {
  return (
    <div className="bg-muted/50 border-border rounded-xl border p-6 text-center">
      <p className="text-muted-foreground text-sm">{s.editLockedMessage}</p>
    </div>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

export function ChatView({ questionnaire, initialAnswersMap, caseStatus }: Props) {
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>(initialAnswersMap)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  // Per-question draft values keyed by question ID — avoids useEffect setState
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, unknown>>({})
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({})
  // null = normal flow, set to a question ID when editing an answered question
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const nav = useMemo(
    () => buildNav(questionnaire, answersMap, skippedIds),
    [questionnaire, answersMap, skippedIds],
  )

  const isLocked = caseStatus === 'under_review'

  // Resolve the currently active question
  const editingQ = editingId ? nav.flatVisible.find((q) => q.id === editingId) ?? null : null
  const isReaskingSkipped = !editingId && !nav.nextQuestion && !!nav.nextSkippedQuestion
  const activeQ: NavQuestion | null =
    editingQ ?? nav.nextQuestion ?? (isReaskingSkipped ? (nav.nextSkippedQuestion ?? null) : null)

  // Derived values — no useEffect needed
  const currentValue: unknown = activeQ
    ? (answerDrafts[activeQ.id] ?? emptyValueFor(activeQ.answer_type))
    : null
  const validationError = activeQ ? (draftErrors[activeQ.id] ?? null) : null

  // Scroll to the active card when the answered count grows
  const answeredCount = nav.flatVisible.filter((q) => q.isAnswered).length
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [answeredCount])

  // Start editing an already-answered question — pre-fill the draft with its saved value
  const startEditing = (q: NavQuestion) => {
    setEditingId(q.id)
    setAnswerDrafts((prev) => ({
      ...prev,
      [q.id]: prev[q.id] !== undefined ? prev[q.id] : q.savedValue,
    }))
    setDraftErrors((prev) => { const n = { ...prev }; delete n[q.id]; return n })
    // Scroll to bottom where the edit card will appear
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  const cancelEdit = () => {
    if (!editingId) return
    const id = editingId
    setEditingId(null)
    setAnswerDrafts((prev) => { const n = { ...prev }; delete n[id]; return n })
    setDraftErrors((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleChange = (v: unknown) => {
    if (!activeQ) return
    setAnswerDrafts((prev) => ({ ...prev, [activeQ.id]: v }))
  }

  const handleSave = () => {
    if (!activeQ || isPending) return

    // Capture values before the async transition
    const qId = activeQ.id
    const qKey = activeQ.key
    const value = currentValue
    const prevValue = answersMap[qKey]
    const wasEditing = editingId

    // Optimistic advance — update the UI immediately; rollback if the server rejects
    setAnswersMap((prev) => ({ ...prev, [qKey]: value }))
    if (wasEditing) setEditingId(null)
    setAnswerDrafts((prev) => { const n = { ...prev }; delete n[qId]; return n })
    setDraftErrors((prev) => { const n = { ...prev }; delete n[qId]; return n })

    startTransition(async () => {
      const result = await saveAnswerAction({
        questionId: qId,
        groupInstance: 'default',
        value,
      })

      if (!result.ok) {
        // Rollback the optimistic update
        setAnswersMap((prev) => {
          if (prevValue === undefined) {
            const n = { ...prev }; delete n[qKey]; return n
          }
          return { ...prev, [qKey]: prevValue }
        })
        if (wasEditing) setEditingId(qId)
        setAnswerDrafts((prev) => ({ ...prev, [qId]: value }))
        setDraftErrors((prev) => ({ ...prev, [qId]: result.error }))
      }
    })
  }

  const handleSkip = () => {
    if (!activeQ || isPending || isReaskingSkipped) return
    setSkippedIds((prev) => new Set([...prev, activeQ.id]))
    setAnswerDrafts((prev) => { const n = { ...prev }; delete n[activeQ.id]; return n })
    setDraftErrors((prev) => { const n = { ...prev }; delete n[activeQ.id]; return n })
  }

  const answeredQuestions = nav.flatVisible.filter((q) => q.isAnswered)

  return (
    <div className="space-y-4">
      {/* Patient notice */}
      <div className="border-border bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {sq.patientBannerTitle}
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{sq.patientBannerBody}</p>
      </div>

      {/* Progress bar */}
      {nav.totalRequired > 0 && <ProgressBar nav={nav} />}

      {/* Answered Q&A history */}
      {answeredQuestions.length > 0 && (
        <div className="space-y-3">
          {answeredQuestions.map((q, i) => (
            <AnsweredBubble
              key={q.id}
              question={q}
              prevQuestion={answeredQuestions[i - 1]}
              onEdit={startEditing}
              isEditing={editingId === q.id}
              locked={isLocked}
            />
          ))}
        </div>
      )}

      {/* Edit-locked banner */}
      {isLocked && <EditLockedCard />}

      {/* Active question card: normal, re-ask, or edit mode */}
      {!isLocked && activeQ && (
        <div ref={bottomRef}>
          <CurrentQuestionCard
            question={activeQ}
            value={currentValue}
            onChange={handleChange}
            error={validationError}
            saving={isPending}
            onSave={handleSave}
            onSkip={!editingId ? handleSkip : undefined}
            onCancel={editingId ? cancelEdit : undefined}
            isEditMode={!!editingId}
            isReask={isReaskingSkipped}
          />
        </div>
      )}

      {/* All done */}
      {!isLocked && !activeQ && nav.allRequiredAnswered && !editingId && <AllAnsweredCard />}
    </div>
  )
}
