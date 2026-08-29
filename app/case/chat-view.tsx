'use client'

import { useState, useMemo, useEffect, useRef, useSyncExternalStore, useTransition } from 'react'
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
import { AUTOSAVE_NOTICE_DISMISSED_KEY } from '@/lib/autosave-notice'
import { capInstances, parseCount } from '@/lib/group-instances'
import { Check, Clock, Info } from 'lucide-react'
import { de } from '@/lib/strings/de'
import {
  btnCopper,
  btnOutline,
  btnPetrol,
  card,
  linkPetrol,
  linkStandalone,
} from '@/components/ui/styles'
import { useCaseTabSwitch } from '@/components/case-tab-context'

const s = de.case.chat

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  questionnaire: LoadedQuestionnaire
  initialAnswersMap: Record<string, unknown>
  initialGroupInstances: Record<string, string[]>
  initialGroupAnswers: Record<string, Record<string, unknown>>
  caseStatus: string
  /* Round 3: headerTitle/headerIntro are gone — the shell's pinned mobile
     chrome (case-tabs) carries title + intro on every viewport now, so this
     view no longer renders an in-scroller copy. */
  /** Live missing-documents count (same number as the tab badge) — drives the
      locked card's docs-aware variant (item 3, go-live round 2). */
  missingDocs: number
  content: {
    // R2-2: caseSubheading / patientBanner* moved OUT — the shell renders the
    // title and the intro line now (F1/F2), so this view no longer reads them.
    autosaveNotice: string
    allAnsweredHeading: string
    allAnsweredMessage: string
    lockedHeading: string
    lockedBody: string
    lockedDocsHeading: string
    lockedDocsBody: string
    lockedDocsButton: string
    // C-1 (bank-docs pass, GATE 1 2026-08-29): the completion cards show the
    // SAME approved missing-documents counter line the docs pane shows —
    // reused rows, no new German. Only the >0 texts are needed here: the
    // cards render the line exclusively in their docs-aware state.
    docsMissingCount: string
    docsMissingCountOne: string
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

/* R7 (mobile round 3): the session-scoped dismissal flag is an EXTERNAL
   store, read via useSyncExternalStore — hydration-safe (the server snapshot
   says "not dismissed", the client snapshot takes over after hydration
   without a mismatch) and free of the setState-in-effect cascade the naive
   effect-read has. The store never *pushes* changes (nothing external writes
   it mid-session), so subscribe is a stable no-op. */
const subscribeToNothing = () => () => {}
const readNoticeDismissed = () => {
  try {
    return sessionStorage.getItem(AUTOSAVE_NOTICE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}
const serverNoticeDismissed = () => false

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ nav }: { nav: NavState }) {
  const label = s.progressLabel
    .replace('{answered}', String(nav.answeredRequired))
    .replace('{total}', String(nav.totalRequired))

  /* E-2: mockup progress treatment — sage-soft track, petrol fill. R2-2 gave
     DESKTOP the petrol %-chip floating above the fill edge; U9 (GATE 1
     2026-08-29) gives MOBILE the drafts' treatment instead: a plain
     left-aligned percentage above the track, no chip, no count line (U6),
     and a size-5 ring marker. Desktop keeps the R2-2 chrome unchanged,
     including the "{n} von {m} Fragen beantwortet" line — the denominator is
     real information a percentage hides. Spec surface (re-verified when U6
     shipped, 2026-08-29): four sites read the line as text at DESKTOP
     viewport ("von N Fragen" — m7-regression ×3, feedback-pass ×1) and stay
     valid; the one mobile-viewport reader (mobile-footer M1) now reads the
     progressbar's aria-label, which keeps the denominator on EVERY viewport
     for screen readers and specs alike.

     The marker is DECORATIVE and must not read as a slider. It carries no
     role and no tabindex, is aria-hidden along with the chip (the track's
     aria-valuenow already states the value), and takes pointer-events-none so
     it cannot be grabbed. role="slider" would advertise an interaction that
     does not exist — the user cannot drag their progress. */
  return (
    <div className="space-y-1.5">
      {/* U6: desktop-only — the mobile drafts show a bare percentage. */}
      <p className="text-graphite-soft hidden text-xs lg:block">{label}</p>
      {/* U9: the mobile percentage — plain graphite, left-aligned (replaces
          the floating chip below lg). */}
      <p className="text-foreground text-xs font-semibold lg:hidden">{nav.progressPercent}%</p>
      {/* lg:pt-6 reserves the row the desktop floating chip occupies, so it
          never overlaps the label above it; mobile has no chip and no
          reserved row. */}
      <div className="relative lg:pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 hidden -translate-x-1/2 transition-all duration-500 ease-out lg:block"
          style={{ left: `${nav.progressPercent}%` }}
        >
          <span className="bg-primary rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {nav.progressPercent}%
          </span>
        </div>
        {/* Inner relative wrapper: the marker centers on the TRACK at every
            viewport (desktop geometry unchanged — track center is where the
            old top-calc put it). */}
        <div className="relative">
          {/* Track color is per-band: sage-soft/60 reads on the DESKTOP cream
              band but disappears on the mobile sage panel (same color), so
              below lg the track uses the deeper sage — the drafts' own
              unfilled-track tone. */}
          <div
            className="bg-sage/60 lg:bg-sage-soft/60 h-1.5 overflow-hidden rounded-full"
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
            className="border-primary bg-background pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-500 ease-out lg:size-3"
            style={{ left: `${nav.progressPercent}%` }}
          />
        </div>
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
  deferred = false,
}: {
  question: NavQuestion
  prevQuestion?: NavQuestion
  onEdit: (q: NavQuestion) => void
  onRemoveInstance: (groupKey: string, instanceId: string) => void
  isEditing: boolean
  locked: boolean
  /** R2-7: rendered as a deferred question — prompt shown, no answer yet. */
  deferred?: boolean
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
      {/* R2-7: a DEFERRED entry gets its own testid. `answered-bubble` means
          "this question has an answer" to every spec that reads it (they
          filter by prompt, then click Bearbeiten — which a deferred entry does
          not have). Reusing the tag for an unanswered entry would quietly
          break that meaning. */}
      <div
        data-testid={deferred ? 'deferred-bubble' : 'answered-bubble'}
        className="flex flex-col gap-2"
      >
        {/* Assistant side — the question.
            R2-3: cream-deep, NOT the mockup's white — separation by shadow
            alone (1.00:1) was rejected by the founder. R8 (gate answer 6c)
            maps cream-deep to brand Cream #F8F3EB: the bubble now separates
            from the white card at 1.09:1 (down from 1.18:1 — the founder's
            explicit call) while the prompt text keeps 12.65:1. The user's
            petrol bubble opposite is 7.61:1, so the two sides stay
            unmistakable. (Re-measured 2026-08-27.) */}
        <div className="bg-cream-deep text-foreground max-w-[85%] self-start rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%]">
          {question.prompt_de}
        </div>
        {/* User side — the saved answer, or R2-7's deferred marker.
            The marker is deliberately NOT a bubble: an answered question has a
            filled petrol bubble, a deferred one has none, so the two states
            differ in SHAPE and not only in colour (WCAG 1.4.1). No amber and no
            red either — deferring is an expected step, not a warning (the
            semantic palette rule). graphite-soft on the card measures 6.79:1
            (re-measured 2026-08-27, R8 values). */}
        {deferred ? (
          <div
            data-testid="deferred-marker"
            className="text-graphite-soft flex max-w-[85%] items-center gap-1.5 self-end pr-1 text-xs italic sm:max-w-[75%]"
          >
            <Clock aria-hidden className="size-3.5 shrink-0 not-italic" />
            <span>{s.skipButton}</span>
          </div>
        ) : (
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
        )}
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
           over the card measures 6.26:1 (re-measured 2026-08-27, R8 values). */
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
          /* R2-3: the skip control takes the mockup's treatment — an
             underlined ghost link rather than a second outlined button, so the
             copper CTA is visibly the primary action. `linkStandalone` keeps
             the 44px touch floor from the E-7 audit (WCAG 2.5.8): this link
             stands alone, it is not inside a sentence.
             The testid exists for the same reason the CTA's does — the label
             renames with it. R2-0's census covered only the save CTA and
             missed these 5 sites; they are repointed in this commit. */
          <button
            type="button"
            data-testid="skip-answer"
            disabled={saving}
            onClick={onSkip}
            className={`${linkPetrol} ${linkStandalone} text-graphite-soft hover:text-foreground text-sm font-medium disabled:pointer-events-none disabled:opacity-50`}
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
  counterText,
}: {
  heading: string
  message: string
  missingDocs: number
  docsButtonLabel: string
  /** C-1: the docs pane's approved missing-count line, '' when nothing to say. */
  counterText: string
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
      {/* C-1 (bank-docs pass, GATE 1 2026-08-29): the concrete count, in the
          docs pane's approved words — "questions done" must not read as
          "application done" while documents are outstanding. '' renders
          nothing (rows absent, or missing == 0 — parent decides). */}
      {counterText !== '' && (
        <p
          data-testid="completion-docs-counter"
          className="text-foreground mt-3 text-sm font-medium"
        >
          {counterText}
        </p>
      )}
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
  counterText,
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
  /** C-1: the docs pane's approved missing-count line, '' when nothing to say. */
  counterText: string
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
      {/* C-1 (bank-docs pass, GATE 1 2026-08-29): the concrete count in the
          docs pane's approved words, docs-variant only — the plain locked
          card says "nichts weiter tun" and must not carry a missing count. */}
      {docsVariant && counterText !== '' && (
        <p
          data-testid="completion-docs-counter"
          className="text-foreground mt-3 text-sm font-medium"
        >
          {counterText}
        </p>
      )}
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
          cream-deep/graphite-soft (6.26:1, re-measured 2026-08-27), not
          petrol. Renders nothing while the content rows are absent ('' by
          design). */}
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

  /* ── R7 (mobile round 3): the autosave notice is dismissed by SCROLLING,
     once per login session — a founder-confirmed reversal of R2-3's
     static-on-purpose decision. Pure client state: a sessionStorage flag
     (cleared on the login page, see lib/autosave-notice.ts) plus local
     state; no X button, no DB row. */
  const dismissedAtLoad = useSyncExternalStore(
    subscribeToNothing,
    readNoticeDismissed,
    serverNoticeDismissed
  )
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const noticeVisible = !!content.autosaveNotice && !dismissedAtLoad && !noticeDismissed
  /* The P1-7 trap: the effect below programmatically scrolls the history to
     the bottom on mount and after every answer — those scroll events must
     NOT count as the user's dismissal scroll, or a returning user's notice
     would vanish before their first gesture. The flag is raised right before
     each programmatic assignment and lowered by the first event it causes
     (direct scrollTop writes fire a single scroll event; smooth scrolling is
     never used here). */
  const programmaticScroll = useRef(false)

  const handleHistoryScroll = () => {
    if (programmaticScroll.current) {
      programmaticScroll.current = false
      return
    }
    if (!noticeVisible) return
    setNoticeDismissed(true)
    try {
      sessionStorage.setItem(AUTOSAVE_NOTICE_DISMISSED_KEY, '1')
    } catch {
      /* storage unavailable → dismissal lasts this render only */
    }
  }

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

  /* C-1 (bank-docs pass, GATE 1 2026-08-29): the completion cards state the
     concrete missing-documents count in the docs pane's own approved words —
     the SAME derivation DocumentArea uses for its counter (missing > 0 only;
     the cards' existing copy stands alone at 0). '' rows degrade to nothing,
     the standard content rollout contract. */
  const docsCounterText =
    missingDocs > 0
      ? missingDocs === 1
        ? content.docsMissingCountOne
        : content.docsMissingCount.replace('{n}', String(missingDocs))
      : ''

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

  /* R2-7: the transcript also shows what the user DEFERRED, so "Später
     beantworten" leaves a trace instead of the question silently vanishing
     until the end of the run.

     DISPLAY ONLY. skippedIds stays exactly the session-scoped client Set it
     was, handleSkip is untouched, and `isAnswered` is unchanged — a skipped
     question is still unanswered, still re-asked once the queue empties, and
     still counts against the progress denominator. Nothing here feeds
     buildNav.

     The active question is excluded: while it is being re-asked it already
     owns the answer footer, and showing a "deferred" marker for the very
     question on screen would contradict it. */
  const transcript = nav.flatVisible.filter(
    (q) =>
      q.isAnswered ||
      (skippedIds.has(draftKey(q.id, q.instanceId)) &&
        !(activeQ && activeQ.id === q.id && activeQ.instanceId === q.instanceId))
  )

  // Scroll history to bottom whenever a new answer lands. Marked as
  // programmatic so R7's scroll-dismiss ignores it (see handleHistoryScroll);
  // when the content fits and no scroll event fires, the stale flag is
  // cleared on the next frame so it cannot swallow a later user scroll.
  useEffect(() => {
    const el = historyRef.current
    if (!el) return
    programmaticScroll.current = true
    el.scrollTop = el.scrollHeight
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        programmaticScroll.current = false
      })
    )
    return () => cancelAnimationFrame(raf)
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
      {/* ── Fixed top: subheader + progress bar ───────────────
          U9 (2026-08-29): below lg this band CONTINUES the shell's sage
          panel (same bg-sage-soft, no border — the panel simply ends where
          the chat begins, per the drafts); desktop keeps the R2-2 cream
          band with its border-b. */}
      <div
        data-testid="case-header"
        className="bg-sage-soft shrink-0 lg:border-border/60 lg:bg-background/95 lg:border-b lg:backdrop-blur"
      >
        <div className="mx-auto max-w-2xl space-y-2 px-7 pt-3 pb-3 lg:px-4">
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

      {/* ── Scrollable middle + pinned bottom, in ONE lg+ white box ───────── */}
      {/* R2-3: the mockup wraps the transcript in one white card. We take the
          LOOK, never its geometry: there the card is a single
          max-h-[calc(100vh-320px)] scroller with the active input INSIDE it,
          which is the shape that clipped the save buttons on real phones. Here
          the frame is painted on the existing flex chain — history keeps its
          own scroller, the answer footer stays a separate shrinkable row — so
          nothing about the reachability guarantee changes.
          D5 (desktop round 1, GATE 1 APPROVED 2026-08-28): from `lg` this
          wrapper IS the screenshot's white central box — infobox, transcript
          and answer area together on #FFFDFA, with the progress band above
          staying outside on cream. Visual only: the wrapper is a plain flex
          pass-through below lg (every lg: class inert), and inside it the
          flex chain is byte-for-byte the one described above, one level
          deeper. At lg the transcript card drops its own chrome (white-in-
          white card would read as a nested box) and the answer footer swaps
          its cream band for the box's white; the border-t hairline stays as
          the divider between scroller and input (decorative, border-border). */}
      <div className="lg:bg-card lg:shadow-card flex min-h-0 flex-1 flex-col lg:mx-auto lg:my-4 lg:w-full lg:max-w-2xl lg:overflow-hidden lg:rounded-2xl">
        <div className="min-h-0 flex-1 overflow-hidden px-4 pt-4 pb-2">
          <div
            ref={historyRef}
            data-testid="chat-history"
            onScroll={handleHistoryScroll}
            className={`${card} mx-auto h-full max-w-2xl space-y-4 overflow-y-auto px-4 py-4 lg:rounded-none lg:shadow-none`}
          >
            {/* Round 3: the mobile title/intro copy that opened this scroller is
              gone — the shell's pinned chrome carries both now (R1/R3). */}

            {/* The autosave reassurance, as a sage hint bubble at the head of
              the transcript. R7 (mobile round 3, founder-confirmed reversal
              of R2-3's static-on-purpose): shown once per login session and
              dismissed by the user's first scroll of this history — no X
              button, no persistence beyond sessionStorage (see
              lib/autosave-notice.ts). Renders nothing while the content row
              is absent ('' by design). */}
            {noticeVisible && (
              <div className="border-sage-soft/70 bg-sage-soft/40 mx-auto flex w-full max-w-[92%] items-start gap-2 rounded-xl border px-3 py-2 sm:max-w-[85%]">
                <Info aria-hidden className="text-primary/70 mt-0.5 size-4 shrink-0" />
                <p className="text-graphite-soft text-sm leading-relaxed">
                  {content.autosaveNotice}
                </p>
              </div>
            )}

            {/* Answered + deferred history — bubble exchange (E-3, R2-7) */}
            {transcript.length > 0 && (
              <div className="flex flex-col gap-2">
                {transcript.map((q, i) => (
                  <AnsweredBubble
                    key={q.instanceId ? `${q.id}:${q.instanceId}` : q.id}
                    question={q}
                    prevQuestion={transcript[i - 1]}
                    onEdit={startEditing}
                    onRemoveInstance={handleDeleteInstance}
                    isEditing={editingId === q.id && editingInstanceId === q.instanceId}
                    locked={isLocked}
                    deferred={!q.isAnswered}
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
          className="border-border/60 bg-background/95 lg:bg-card min-h-0 overflow-y-auto overscroll-contain border-t backdrop-blur lg:backdrop-blur-none"
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
                counterText={docsCounterText}
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
                counterText={docsCounterText}
              />
            ) : null}
          </div>
        </div>
        {/* closes the D5 lg+ white box (transcript + answer area) */}
      </div>
    </div>
  )
}
