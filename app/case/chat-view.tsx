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

function AnsweredBubble({ question, prevQuestion }: { question: NavQuestion; prevQuestion?: NavQuestion }) {
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
        <div className="bg-primary/10 inline-block max-w-full rounded-lg px-3 py-2 text-sm">
          {displayValue}
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
}: {
  question: NavQuestion
  value: unknown
  onChange: (v: unknown) => void
  error: string | null
  saving: boolean
  onSave: () => void
  onSkip: () => void
}) {
  const showSectionHeader = true // always show for the current question card

  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm space-y-4">
      <div className="border-border border-b pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {question.categoryLabel}
        </h3>
      </div>

      <QuestionRenderer question={question} value={value} onChange={onChange} />

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
          {saving ? s.savingButton : s.nextButton}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground border-border rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
          {s.skipButton}
        </button>
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
  const [currentValue, setCurrentValue] = useState<unknown>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const nav = useMemo(
    () => buildNav(questionnaire, answersMap, skippedIds),
    [questionnaire, answersMap, skippedIds],
  )

  const currentQ = nav.nextQuestion
  const isLocked = caseStatus === 'under_review'

  // Reset input value when the current question changes
  useEffect(() => {
    if (currentQ) {
      setCurrentValue(emptyValueFor(currentQ.answer_type))
      setValidationError(null)
    }
  }, [currentQ?.id])

  // Scroll to the current question card when a new one appears
  const answeredCount = nav.flatVisible.filter((q) => q.isAnswered).length
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [answeredCount])

  const handleSave = () => {
    if (!currentQ || isPending) return

    startTransition(async () => {
      const result = await saveAnswerAction({
        questionId: currentQ.id,
        groupInstance: 'default',
        value: currentValue,
      })

      if (!result.ok) {
        setValidationError(result.error)
        return
      }

      // Optimistic update — nav recomputes, next question appears
      setAnswersMap((prev) => ({ ...prev, [currentQ.key]: currentValue }))
    })
  }

  const handleSkip = () => {
    if (!currentQ || isPending) return
    setSkippedIds((prev) => new Set([...prev, currentQ.id]))
    setCurrentValue(null)
    setValidationError(null)
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
            <AnsweredBubble key={q.id} question={q} prevQuestion={answeredQuestions[i - 1]} />
          ))}
        </div>
      )}

      {/* Edit-locked banner */}
      {isLocked && <EditLockedCard />}

      {/* Current question */}
      {!isLocked && currentQ && (
        <div ref={bottomRef}>
          <CurrentQuestionCard
            question={currentQ}
            value={currentValue}
            onChange={setCurrentValue}
            error={validationError}
            saving={isPending}
            onSave={handleSave}
            onSkip={handleSkip}
          />
        </div>
      )}

      {/* All done state */}
      {!isLocked && nav.allRequiredAnswered && !currentQ && <AllAnsweredCard />}
    </div>
  )
}
