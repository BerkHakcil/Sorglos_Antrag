'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { capInstances, parseCount } from '@/lib/group-instances'
import { Check, Clock } from 'lucide-react'
import { de } from '@/lib/strings/de'
import { btnCopper, btnOutline, btnPetrol, card } from '@/components/ui/styles'
import { useCaseTabSwitch } from '@/components/case-tab-context'

const s = de.case.chat
const sc = de.case

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  questionnaire: LoadedQuestionnaire
  initialAnswersMap: Record<string, unknown>
  initialGroupInstances: Record<string, string[]>
  initialGroupAnswers: Record<string, Record<string, unknown>>
  caseStatus: string
  /** Live missing-documents count (same number as the tab badge) — drives the
      locked card's docs-aware variant (item 3, go-live round 2). */
  missingDocs: number
  content: {
    // R2-2: caseSubheading / patientBanner* moved OUT — the shell renders the
    // title and the intro line now (F1/F2), so this view no longer reads them.
    allAnsweredHeading: string
    allAnsweredMessage: string
    lockedHeading: string
    lockedBody: string
    lockedDocsHeading: string
    lockedDocsBody: string
    lockedDocsButton: string
    nextStepsUpload: string
    nextStepsHeading: string
    nextSteps1: string
    nextSteps2: string
    nextSteps3: string
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyValueFor(answerType: string): unknown {
  switch (answerType) {
    case 'address':
      return { street: '', plz: '', city: '' }
    case 'person':
      return { first_name: '', last_name: '', birth_date: '' }
    case 'bank_account':
      return { iban: '', bic: '', bank_name: '' }
    case 'multi_select':
      return []
    default:
      return ''
  }
}

/**
 * Initial draft for a question the user hasn't touched yet: a data-driven
 * default (validation.default, e.g. country_of_birth → "Deutschland") when the
 * content author set one, otherwise the type's empty value. handleSave submits
 * currentValue, so an untouched pre-selected default is what gets saved.
 */
function initialValueFor(question: {
  answer_type: string
  validation: Record<string, unknown> | null
}): unknown {
  const dflt = question.validation?.['default']
  return dflt !== undefined ? dflt : emptyValueFor(question.answer_type)
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

  /* E-2: mockup progress treatment — sage-soft track, petrol fill, and the
     percentage as a petrol chip rather than plain text. The bar is the only
     part of chat-view E-2 touches; bubbles, history and the answer footer
     belong to E-3. role/aria added here because the old markup conveyed
     progress purely visually. */
  /* R2-2: the mockup's treatment — a petrol %-chip that FLOATS above the fill
     edge, with a ring marker riding the same edge, instead of a chip parked in
     the corner. The "{n} von {m} Fragen beantwortet" label stays (the mockup
     shows a bare percentage): the denominator is real information a percentage
     hides, and four spec sites read it.

     The marker is DECORATIVE and must not read as a slider. It carries no
     role and no tabindex, is aria-hidden along with the chip (the track's
     aria-valuenow already states the value), and takes pointer-events-none so
     it cannot be grabbed. role="slider" would advertise an interaction that
     does not exist — the user cannot drag their progress. */
  return (
    <div className="space-y-1.5">
      <p className="text-graphite-soft text-xs">{label}</p>
      {/* pt-6 reserves the row the floating chip occupies, so it never
          overlaps the label above it. */}
      <div className="relative pt-6">
        <div
          className="bg-sage-soft/60 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={nav.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${nav.progressPercent}%` }}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${nav.progressPercent}%` }}
        >
          <span className="bg-primary rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {nav.progressPercent}%
          </span>
        </div>
        <div
          aria-hidden
          className="border-primary bg-background pointer-events-none absolute size-3 -translate-x-1/2 rounded-full border-2 transition-all duration-500 ease-out"
          style={{ left: `${nav.progressPercent}%`, top: 'calc(1.5rem - 0.1875rem)' }}
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
    !prevQuestion || prevQuestion.categoryId !== question.categoryId || isNewInstance

  const sectionLabel =
    question.instanceId && question.instanceIndex > 0
      ? s.repeatableGroup.instanceLabel
          .replace('{group}', question.group_label_de ?? question.categoryLabel)
          .replace('{index}', String(question.instanceIndex))
      : question.categoryLabel

  const displayValue = formatAnswerForDisplay(question, question.savedValue)

  /* E-3: the answered history becomes a real exchange — the QUESTION is an
     assistant bubble on the left (white, square bottom-left corner), the
     ANSWER is a user bubble on the right (petrol, square bottom-right). The
     section label becomes the mockup's centred sage pill instead of a ruled
     heading row.
     Deliberately NOT adopted from the mockup here: the pencil-icon "Ändern"
     affordance and the sent-check. Those change the affordance itself, not
     its paint, so they are behaviour-adjacent and deferred. The existing
     "Bearbeiten" text button is kept verbatim — same element, same label. */
  return (
    <>
      {showSectionHeader && (
        <div className="flex items-center justify-center gap-2 pt-3 pb-1">
          <h3 className="bg-sage-soft/70 text-primary rounded-full px-3 py-1 text-xs font-medium">
            {sectionLabel}
          </h3>
          {/* Count-driven groups (D15): no direct instance removal — the count
              question is the single source of how many instances exist. */}
          {!locked &&
            question.instanceId &&
            isNewInstance &&
            question.instanceIndex > 1 &&
            !question.group_count_source_key && (
              <button
                type="button"
                onClick={() => onRemoveInstance(question.group_key!, question.instanceId!)}
                className="text-graphite-soft hover:text-destructive inline-flex min-h-11 items-center text-xs underline underline-offset-2"
              >
                {s.repeatableGroup.removeInstanceLabel}
              </button>
            )}
        </div>
      )}
      {/* data-testid is the e2e anchor for one answered Q&A pair.
          transitive-visibility-fix.spec previously located this wrapper by its
          CSS class (`div.space-y-1`) and broke silently when E-3 changed the
          layout to flex — the click simply waited out its timeout against a
          page that rendered perfectly. Same lesson as E-0's `.shrink-0.border-t`;
          this one was missed by that census. */}
      <div data-testid="answered-bubble" className="flex flex-col gap-2">
        {/* Assistant side — the question */}
        <div className="bg-card text-foreground max-w-[85%] self-start rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:max-w-[75%]">
          {question.prompt_de}
        </div>
        {/* User side — the saved answer */}
        <div className="flex max-w-[85%] flex-col items-end gap-1 self-end sm:max-w-[75%]">
          <div
            className={`bg-primary rounded-2xl rounded-br-md px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm ${
              isEditing ? 'ring-primary ring-2 ring-offset-2' : ''
            }`}
          >
            {displayValue}
          </div>
          {!locked && (
            <button
              type="button"
              onClick={() => onEdit(question)}
              className="text-graphite-soft hover:text-primary inline-flex min-h-11 items-center pr-1 text-xs underline underline-offset-2"
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
    <div data-testid="question-card" className={`${card} space-y-4 p-5`}>
      {/* Category label intentionally omitted here — it stays in the answered
          history (AnsweredBubble) so it isn't repeated on every active card. */}
      {isReask && (
        /* E-3: the re-ask note takes the mockup's sage hint-bubble treatment
           instead of the amber alert. Sage reads as guidance rather than
           warning, which is what a re-ask is. graphite-soft on sage-soft/40
           measures 9.1:1. */
        <div className="border-sage-soft/70 bg-sage-soft/40 rounded-xl border px-3 py-2">
          <p className="text-graphite-soft text-sm leading-relaxed">{s.reaskNote}</p>
        </div>
      )}

      <QuestionRenderer question={question} value={value} onChange={onChange} onSubmit={onSave} />

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* R2-0 (UI round 2): the save CTA carries a testid because its LABEL
            is about to change ("Weiter" → "Antwort speichern", D4). 13 spec and
            script sites selected it by accessible name; anchoring them here
            first means the rename in R2-3 touches no test. Same lesson as
            E-0's `.shrink-0.border-t` — structure and specs never move in one
            commit. */}
        <button
          type="button"
          data-testid="save-answer"
          disabled={saving}
          onClick={onSave}
          className={btnCopper}
        >
          {saving ? s.savingButton : isEditMode ? s.editSaveButton : s.nextButton}
        </button>

        {onCancel && (
          <button type="button" disabled={saving} onClick={onCancel} className={btnOutline}>
            {s.editCancelButton}
          </button>
        )}

        {onSkip && !isEditMode && !isReask && (
          <button type="button" disabled={saving} onClick={onSkip} className={btnOutline}>
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
  // DB-authored per-group prompt wins; the {group} template is only the fallback
  // (grammar of "eine weitere {label}" breaks for some labels, e.g. "Weitere …").
  const question =
    prompt.customPromptDe ?? s.repeatableGroup.anotherPrompt.replace('{group}', prompt.groupLabelDe)
  return (
    <div data-testid="group-prompt" className={`${card} space-y-4 p-5`}>
      <p className="text-[15px] leading-relaxed font-medium">{question}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={onYes} className={btnCopper}>
          {s.repeatableGroup.yesButton}
        </button>
        <button type="button" disabled={saving} onClick={onNo} className={btnOutline}>
          {s.repeatableGroup.noButton}
        </button>
      </div>
    </div>
  )
}

function CountDecreaseConfirmCard({
  onConfirm,
  onCancel,
  saving,
}: {
  onConfirm: () => void
  onCancel: () => void
  saving: boolean
}) {
  // Pass 4 / D15 confirm-and-clear. All strings PLACEHOLDER_DE (Roman nod
  // list). Deliberately NOT --destructive styling on the card itself: the
  // register is a question, not an error — but the confirm button is the
  // copper primary, matching every other decisive action.
  const c = s.countDecrease
  return (
    <div data-testid="count-decrease-confirm" className={`${card} space-y-4 p-5`}>
      <p className="text-[15px] leading-relaxed font-medium">{c.title}</p>
      <p className="text-graphite-soft text-sm leading-relaxed">{c.body}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={onConfirm} className={btnCopper}>
          {c.confirmButton}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className={btnOutline}>
          {c.cancelButton}
        </button>
      </div>
    </div>
  )
}

function AllAnsweredCard({
  heading,
  message,
  missingDocs,
  docsButtonLabel,
}: {
  heading: string
  message: string
  missingDocs: number
  docsButtonLabel: string
}) {
  /* Item 3 (go-live round 2): when documents are still missing, this
     transient card carries the same "Zu den Dokumenten" push as the locked
     card (it shows first, for the seconds before router.refresh swaps in the
     locked state — a user who walks away has still seen it). Additive only:
     heading/message stay untouched (the existing German already instructs
     uploading), and at missing==0 or absent button text the card renders
     byte-identically to before. Note the count is the PREVIOUS server
     render's value during those seconds — transient and self-healing. */
  const switchTab = useCaseTabSwitch()
  return (
    /* E-6: the ACHIEVEMENT state, on the mockup's /fertig pattern — petrol
       check medallion, petrol heading, centred. Petrol is the palette's
       positive tone and this is the one moment that has earned it: the user
       has answered everything.
       The mockup's "Nächste Schritte" numbered list is deliberately NOT
       built. Its copy is Lovable-authored German we do not have Roman's
       version of, and inventing structure for absent text would leave an
       empty scaffold on a real user's screen (R3). */
    <div
      data-testid="all-answered"
      className={`${card} flex flex-col items-center p-6 text-center`}
    >
      <span
        aria-hidden
        className="bg-primary grid size-14 place-items-center rounded-full text-white"
      >
        <Check className="size-7" strokeWidth={2.5} />
      </span>
      <p className="text-primary mt-5 text-xl font-medium">{heading}</p>
      <p className="text-foreground mt-3 max-w-md text-base leading-relaxed">{message}</p>
      {missingDocs > 0 && docsButtonLabel !== '' && switchTab && (
        <button
          type="button"
          data-testid="all-answered-docs-button"
          className={`${btnPetrol} mt-5`}
          onClick={() => switchTab('documents')}
        >
          {docsButtonLabel}
        </button>
      )}
    </div>
  )
}

function EditLockedCard({
  heading,
  body,
  nextStepsHeading,
  nextSteps,
  missingDocs,
  docsHeading,
  docsBody,
  docsButtonLabel,
  nextStepsUpload,
}: {
  heading: string
  body: string
  nextStepsHeading: string
  nextSteps: string[]
  missingDocs: number
  docsHeading: string
  docsBody: string
  docsButtonLabel: string
  nextStepsUpload: string
}) {
  /* Item 3 (go-live round 2): docs-aware variant. While documents are still
     missing, "Sie müssen nichts weiter tun" is false — the variant swaps
     heading/body, adds the petrol "Zu den Dokumenten" button (tab switch via
     context; hidden when no provider or no button text — an empty petrol
     button must never render), and prefixes the upload step to the
     Nächste-Schritte list. missing == 0 OR content rows not yet seeded ('' by
     design) → today's card byte-identical; that ''-guard is the rollout
     contract with migration 20260813000002. Copy + UI conditionality ONLY —
     status, lock, and flow are untouched. */
  const switchTab = useCaseTabSwitch()
  const docsVariant = missingDocs > 0 && docsHeading !== '' && docsBody !== ''
  const effectiveHeading = docsVariant ? docsHeading : heading
  const effectiveBody = docsVariant ? docsBody : body
  const effectiveSteps = docsVariant ? [nextStepsUpload, ...nextSteps].filter(Boolean) : nextSteps
  return (
    /* E-6: the PENDING state, and deliberately NOT a celebration.
       It shares the /fertig layout so the two read as one family, but its
       tones are neutral-informational: a cream-deep medallion with a
       graphite-soft clock, and a graphite heading — not the petrol check.
       Reason: petrol is the positive/confirmed tone, and "Angaben werden
       geprüft" is not a confirmation. A petrol tick here would tell the user
       their application had been approved, which is a claim we cannot make
       and which no German copy on this card supports. Amber and red stay out
       too — being under review is not a warning. Neutral is the honest
       register for "you are done; someone else now has to act". */
    <div
      data-testid="locked-banner"
      data-docs-missing={missingDocs}
      className={`${card} flex flex-col items-center p-6 text-center`}
    >
      {/* Medallion stays the neutral clock in BOTH variants (E-6 semantic
          rule): being under review is not a warning, even with documents
          outstanding — the heading/body/button carry the docs message. */}
      <span
        aria-hidden
        className="bg-cream-deep text-graphite-soft grid size-14 place-items-center rounded-full"
      >
        <Clock className="size-7" />
      </span>
      <p className="text-foreground mt-5 text-xl font-medium">{effectiveHeading}</p>
      <p className="text-graphite-soft mt-3 max-w-md text-base leading-relaxed">{effectiveBody}</p>
      {docsVariant && docsButtonLabel !== '' && switchTab && (
        <button
          type="button"
          data-testid="locked-docs-button"
          className={`${btnPetrol} mt-5`}
          onClick={() => switchTab('documents')}
        >
          {docsButtonLabel}
        </button>
      )}
      {/* Pass 4 / D2: Roman's three steps — LOCKED state only by decision
          (2026-08-01): in the all-answered state documents may still be
          missing, so "Antrag zur Unterschrift" would over-promise there.
          Tones stay in this card's neutral register (E-6): being under
          review is not a celebration, so the number medallions are
          cream-deep/graphite (5.21:1), not petrol. Renders nothing while the
          content rows are absent ('' by design). */}
      {effectiveSteps.length > 0 && (
        <div data-testid="next-steps" className="mt-6 w-full max-w-md text-left">
          {nextStepsHeading && (
            <p className="text-foreground text-sm font-semibold">{nextStepsHeading}</p>
          )}
          <ol className="mt-3 space-y-2">
            {effectiveSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-cream-deep text-graphite-soft grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
                >
                  {i + 1}
                </span>
                <span className="text-graphite-soft text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

export function ChatView({
  questionnaire,
  initialAnswersMap,
  initialGroupInstances,
  initialGroupAnswers,
  caseStatus,
  missingDocs,
  content,
}: Props) {
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>(initialAnswersMap)

  // groupInstances: groupKey → ordered list of stable instance UUIDs
  const [groupInstances, setGroupInstances] =
    useState<Record<string, string[]>>(initialGroupInstances)
  // groupAnswers: instanceId → { questionKey → value }
  const [groupAnswers, setGroupAnswers] =
    useState<Record<string, Record<string, unknown>>>(initialGroupAnswers)
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
  // Server components re-render on refresh so the document tab's slots/badge
  // recompute live as answers change (feedback pass item 2); ChatView state is
  // initialized once from props, so the refresh never disturbs the chat.
  const router = useRouter()

  // Ref for the scrollable history container — scrolled to bottom when new answers arrive
  const historyRef = useRef<HTMLDivElement>(null)

  const nav = useMemo(
    () =>
      buildNav(
        questionnaire,
        answersMap,
        groupInstances,
        groupAnswers,
        dismissedGroups,
        skippedIds
      ),
    [questionnaire, answersMap, groupInstances, groupAnswers, dismissedGroups, skippedIds]
  )

  // Pass 4 / D15: count-source question key → the group it drives (today only
  // pension_count → pension). Saving such a question adjusts the group's
  // instance list to exactly N; a DECREASE below the number of filled
  // instances needs the confirm-and-clear dialog first (founder decision
  // 2026-08-01) — the excess instances leave flatVisible on save and the
  // server's stale-answer sweep deletes their rows.
  const countGroups = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cat of questionnaire.categories) {
      for (const q of cat.questions) {
        if (q.group_count_source_key && q.group_key) map[q.group_count_source_key] = q.group_key
      }
    }
    return map
  }, [questionnaire])

  // Non-null while a count decrease awaits the user's confirmation.
  const [pendingCountDecrease, setPendingCountDecrease] = useState<{ groupKey: string } | null>(
    null
  )

  const isLocked = caseStatus === 'under_review'

  /* R2-2 (F1): the live status label and its colour class are gone with the
     header meta row they fed. The state they described is still communicated,
     but at the moment it matters and in full sentences — the all-answered card
     and the locked card — rather than as a permanent word in the chrome. */

  // ── Resolve the currently active question ──────────────────────────────────
  const editingQ = editingId
    ? (nav.flatVisible.find((q) => q.id === editingId && q.instanceId === editingInstanceId) ??
      null)
    : null
  const isReaskingSkipped = !editingId && !nav.nextQuestion && !!nav.nextSkippedQuestion
  const activeQ: NavQuestion | null =
    editingQ ?? nav.nextQuestion ?? (isReaskingSkipped ? (nav.nextSkippedQuestion ?? null) : null)

  const dk = activeQ ? draftKey(activeQ.id, activeQ.instanceId) : null
  const currentValue: unknown = activeQ
    ? dk !== null
      ? (answerDrafts[dk] ?? initialValueFor(activeQ))
      : initialValueFor(activeQ)
    : null
  const validationError = activeQ
    ? (draftErrors[draftKey(activeQ.id, activeQ.instanceId)] ?? null)
    : null

  const answeredQuestions = nav.flatVisible.filter((q) => q.isAnswered)
  const answeredCount = answeredQuestions.length

  // Scroll history to bottom whenever a new answer lands
  useEffect(() => {
    const el = historyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [answeredCount])

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
    setDraftErrors((prev) => {
      const n = { ...prev }
      delete n[dk2]
      return n
    })
  }

  const cancelEdit = () => {
    if (!editingId) return
    const id = editingId
    const iid = editingInstanceId
    setEditingId(null)
    setEditingInstanceId(null)
    const dk2 = draftKey(id, iid)
    setAnswerDrafts((prev) => {
      const n = { ...prev }
      delete n[dk2]
      return n
    })
    setDraftErrors((prev) => {
      const n = { ...prev }
      delete n[dk2]
      return n
    })
  }

  const handleChange = (v: unknown) => {
    if (!activeQ) return
    setAnswerDrafts((prev) => ({ ...prev, [draftKey(activeQ.id, activeQ.instanceId)]: v }))
  }

  // Remove answers the server cleared because this save hid them (BUG B), so a
  // later re-show of the controller re-prompts instead of resurfacing stale data.
  const applyClearedAnswers = (cleared: { questionKey: string; groupInstance: string }[]) => {
    const globalKeys = cleared
      .filter((c) => c.groupInstance === 'default')
      .map((c) => c.questionKey)
    const groupItems = cleared.filter((c) => c.groupInstance !== 'default')
    if (globalKeys.length > 0) {
      setAnswersMap((prev) => {
        const n = { ...prev }
        for (const k of globalKeys) delete n[k]
        return n
      })
    }
    if (groupItems.length > 0) {
      setGroupAnswers((prev) => {
        const n = { ...prev }
        for (const { questionKey, groupInstance } of groupItems) {
          if (n[groupInstance]) {
            const inst = { ...n[groupInstance] }
            delete inst[questionKey]
            n[groupInstance] = inst
          }
        }
        return n
      })
    }
  }

  const handleSave = (countDecreaseConfirmed = false) => {
    if (!activeQ || isPending) return

    const qId = activeQ.id
    const qKey = activeQ.key
    const instanceId = activeQ.instanceId
    const value = currentValue
    const dk2 = draftKey(qId, instanceId)
    const wasEditing = editingId

    // ── Count-driven group adjustment (pass 4 / D15) ────────────────────────
    const countGroupKey = countGroups[qKey]
    let instancesAdjustment: { groupKey: string; prev: string[]; next: string[] } | null = null
    if (countGroupKey && !instanceId) {
      const newN = parseCount(value)
      const current = groupInstances[countGroupKey] ?? []
      const droppedWithData = current
        .slice(newN)
        .some((iid) =>
          Object.values(groupAnswers[iid] ?? {}).some(
            (v) => v !== undefined && v !== null && v !== ''
          )
        )
      if (droppedWithData && !countDecreaseConfirmed) {
        // Confirm-and-clear: ask before the save deletes the excess instances'
        // data (the sweep clears their rows once they leave flatVisible).
        setPendingCountDecrease({ groupKey: countGroupKey })
        return
      }
      instancesAdjustment = {
        groupKey: countGroupKey,
        prev: current,
        next: capInstances(current, newN, () => crypto.randomUUID()),
      }
      setPendingCountDecrease(null)
    }

    if (instanceId) {
      // ── Group question save ───────────────────────────────────────────────
      const prevGroupValue = (groupAnswers[instanceId] ?? {})[qKey]

      setGroupAnswers((prev) => ({
        ...prev,
        [instanceId]: { ...(prev[instanceId] ?? {}), [qKey]: value },
      }))
      if (wasEditing) {
        setEditingId(null)
        setEditingInstanceId(null)
      }
      setAnswerDrafts((prev) => {
        const n = { ...prev }
        delete n[dk2]
        return n
      })
      setDraftErrors((prev) => {
        const n = { ...prev }
        delete n[dk2]
        return n
      })

      startTransition(async () => {
        const result = await saveAnswerAction({ questionId: qId, groupInstance: instanceId, value })
        if (!result.ok) {
          setGroupAnswers((prev) => {
            const inst = { ...(prev[instanceId] ?? {}) }
            if (prevGroupValue === undefined) delete inst[qKey]
            else inst[qKey] = prevGroupValue
            return { ...prev, [instanceId]: inst }
          })
          if (wasEditing) {
            setEditingId(qId)
            setEditingInstanceId(instanceId)
          }
          setAnswerDrafts((prev) => ({ ...prev, [dk2]: value }))
          setDraftErrors((prev) => ({ ...prev, [dk2]: result.error }))
        } else {
          if (result.clearedAnswers.length > 0) applyClearedAnswers(result.clearedAnswers)
          router.refresh()
        }
      })
    } else {
      // ── Non-group question save ───────────────────────────────────────────
      const prevValue = answersMap[qKey]

      setAnswersMap((prev) => ({ ...prev, [qKey]: value }))
      // Count save: the driven group's instance list becomes exactly N in the
      // same render, so nav/progress/docs recompute consistently.
      if (instancesAdjustment) {
        const { groupKey, next } = instancesAdjustment
        setGroupInstances((prev) => ({ ...prev, [groupKey]: next }))
      }
      if (wasEditing) {
        setEditingId(null)
        setEditingInstanceId(null)
      }
      setAnswerDrafts((prev) => {
        const n = { ...prev }
        delete n[dk2]
        return n
      })
      setDraftErrors((prev) => {
        const n = { ...prev }
        delete n[dk2]
        return n
      })

      startTransition(async () => {
        const result = await saveAnswerAction({ questionId: qId, groupInstance: 'default', value })
        if (!result.ok) {
          setAnswersMap((prev) => {
            if (prevValue === undefined) {
              const n = { ...prev }
              delete n[qKey]
              return n
            }
            return { ...prev, [qKey]: prevValue }
          })
          // Failed count save: the instance adjustment rolls back with it.
          if (instancesAdjustment) {
            const { groupKey, prev: prevList } = instancesAdjustment
            setGroupInstances((prev) => ({ ...prev, [groupKey]: prevList }))
          }
          if (wasEditing) {
            setEditingId(qId)
            setEditingInstanceId(null)
          }
          setAnswerDrafts((prev) => ({ ...prev, [dk2]: value }))
          setDraftErrors((prev) => ({ ...prev, [dk2]: result.error }))
        } else {
          if (result.clearedAnswers.length > 0) applyClearedAnswers(result.clearedAnswers)
          router.refresh()
        }
      })
    }
  }

  const handleSkip = () => {
    if (!activeQ || isPending || isReaskingSkipped) return
    // Works for repeatable-group members too: draftKey(id, instanceId) produces
    // the same compound key buildNav's skipKey() checks (CP3/D13 fix — group
    // members previously had no skip button at all).
    const sk = draftKey(activeQ.id, activeQ.instanceId)
    setSkippedIds((prev) => new Set([...prev, sk]))
    setAnswerDrafts((prev) => {
      const n = { ...prev }
      delete n[sk]
      return n
    })
    setDraftErrors((prev) => {
      const n = { ...prev }
      delete n[sk]
      return n
    })
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
      Object.keys(n).forEach((k) => {
        if (k.endsWith(`:${instanceId}`)) delete n[k]
      })
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
  const showAllDone =
    !isLocked && !editingId && nav.allRequiredAnswered && !nav.groupPrompt && !activeQ

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* ── Fixed top: subheader + progress bar ─────────────── */}
      <div
        data-testid="case-header"
        className="border-border/60 bg-background/95 shrink-0 border-b backdrop-blur"
      >
        <div className="mx-auto max-w-2xl space-y-2 px-4 pt-3 pb-3">
          {/* R2-2 (F1): the case-id / PLZ / status meta row is gone. The id
              snippet served ops (which has scripts/case-export.mjs), the PLZ is
              confirmed in the pre-step, and the status is stated by the
              locked / all-answered cards at the moment it matters. The
              mockup's header carries the title and the progress, nothing else.
              R2-2 (F2): the sage patient banner is gone from BOTH its copies —
              its text is now the header's intro line, where the mockup puts it,
              so it is said once instead of twice. The row it occupied here is
              what made room for the title. */}
          {/* Progress bar */}
          {nav.totalRequired > 0 && <ProgressBar nav={nav} />}
        </div>
      </div>

      {/* ── Scrollable middle: answered history ─────────────── */}
      <div ref={historyRef} data-testid="chat-history" className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          {/* R2-2 (F2): the mobile copy of the patient notice is gone too. Both
              copies existed because the banner was a block competing with the
              chat for pinned height; as the header's intro line the same
              sentence is shown once, at both sizes, above the fold. */}

          {/* Answered Q&A history — bubble exchange (E-3) */}
          {answeredQuestions.length > 0 && (
            <div className="flex flex-col gap-2">
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
      {/* data-testid is the e2e anchor for this region. The suites previously
          targeted the CSS classes (`.shrink-0.border-t`), which couples them to
          styling — see docs/feedback/pass3_phase_e_plan.md §6. */}
      {/* NOT shrink-0 (mobile field report, 2026-08-11): this slot sits below
          the only scroller inside overflow-hidden ancestors, so content
          taller than the viewport remainder used to CLIP unreachably —
          measured 36px of the Weiter row cut off at a 667px viewport. As a
          plain shrinkable flex item (history has basis 0 and case-header is
          shrink-0, so flexbox gives this footer exactly the remaining
          height) with its own overflow, any oversized card scrolls within
          the footer instead of clipping. min-h-0 documents the intent; the
          overflow already disables the min-content floor. Fits-anyway
          content renders byte-identically. */}
      <div
        data-testid="answer-footer"
        className="border-border/60 bg-background/95 min-h-0 overflow-y-auto overscroll-contain border-t backdrop-blur"
      >
        <div className="mx-auto max-w-2xl px-4 py-4">
          {isLocked ? (
            <EditLockedCard
              heading={content.lockedHeading}
              body={content.lockedBody}
              nextStepsHeading={content.nextStepsHeading}
              nextSteps={[content.nextSteps1, content.nextSteps2, content.nextSteps3].filter(
                Boolean
              )}
              missingDocs={missingDocs}
              docsHeading={content.lockedDocsHeading}
              docsBody={content.lockedDocsBody}
              docsButtonLabel={content.lockedDocsButton}
              nextStepsUpload={content.nextStepsUpload}
            />
          ) : showGroupPrompt && nav.groupPrompt ? (
            <GroupPromptCard
              prompt={nav.groupPrompt}
              onYes={() => handleGroupYes(nav.groupPrompt!.groupKey)}
              onNo={() => handleGroupNo(nav.groupPrompt!.groupKey)}
              saving={isPending}
            />
          ) : pendingCountDecrease && activeQ ? (
            <CountDecreaseConfirmCard
              onConfirm={() => handleSave(true)}
              onCancel={() => setPendingCountDecrease(null)}
              saving={isPending}
            />
          ) : showQuestionCard && activeQ ? (
            <CurrentQuestionCard
              question={activeQ}
              value={currentValue}
              onChange={handleChange}
              error={validationError}
              saving={isPending}
              /* Wrapped: handleSave takes countDecreaseConfirmed — passing the
                 handler bare would feed it the click event (truthy) and skip
                 the confirm dialog. */
              onSave={() => handleSave()}
              onSkip={!editingId ? handleSkip : undefined}
              onCancel={editingId ? cancelEdit : undefined}
              isEditMode={!!editingId}
              isReask={isReaskingSkipped}
            />
          ) : showAllDone ? (
            <AllAnsweredCard
              heading={content.allAnsweredHeading}
              message={content.allAnsweredMessage}
              missingDocs={missingDocs}
              docsButtonLabel={content.lockedDocsButton}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
