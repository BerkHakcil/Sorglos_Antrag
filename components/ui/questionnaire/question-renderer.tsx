/**
 * Generic question renderer — dispatches on answer_type.
 *
 * M2: components are display-only (rendered with correct HTML structure
 * but no save handlers). M3 wires up onChange → Server Action per question.
 *
 * Zero question keys or answer_type strings appear anywhere except this one
 * switch statement. Adding a new answer type = one new case here + one new
 * component. No per-question branches elsewhere in the UI.
 */
'use client'

import type { Question, QuestionOption } from '@/lib/questionnaire-engine'
import { de } from '@/lib/strings/de'

const s = de.case.questionnaire

// ── Individual input components (display-only in M2) ─────────────────────────

function ShortTextInput({ question }: { question: Question }) {
  return (
    <input
      type="text"
      disabled
      placeholder=""
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
    />
  )
}

function LongTextInput({ question: q }: { question: Question }) {
  return (
    <textarea
      disabled
      rows={3}
      aria-label={q.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
    />
  )
}

function NumberInput({ question }: { question: Question }) {
  return (
    <input
      type="number"
      disabled
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
    />
  )
}

function AmountInput({ question }: { question: Question }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        disabled
        step="0.01"
        aria-label={question.prompt_de}
        className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
      />
      <span className="text-muted-foreground shrink-0 text-sm">€</span>
    </div>
  )
}

function DateInput({ question }: { question: Question }) {
  return (
    <input
      type="date"
      disabled
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 rounded-md border px-3 py-2 text-sm"
    />
  )
}

function YesNoInput({ question }: { question: Question }) {
  return (
    <div className="flex gap-4">
      {['Ja', 'Nein'].map((opt) => (
        <label key={opt} className="flex cursor-not-allowed items-center gap-2 text-sm">
          <input type="radio" disabled name={`yn-${question.id}`} value={opt} />
          {opt}
        </label>
      ))}
    </div>
  )
}

function SingleSelectInput({
  question,
  options,
}: {
  question: Question
  options: QuestionOption[]
}) {
  return (
    <select
      disabled
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
    >
      <option value="">–</option>
      {options.map((o) => (
        <option key={o.id} value={o.value}>
          {o.label_de}
        </option>
      ))}
    </select>
  )
}

function MultiSelectInput({
  question: _q,
  options,
}: {
  question: Question
  options: QuestionOption[]
}) {
  return (
    <div className="space-y-1">
      {options.map((o) => (
        <label key={o.id} className="flex cursor-not-allowed items-center gap-2 text-sm">
          <input type="checkbox" disabled value={o.value} />
          {o.label_de}
        </label>
      ))}
    </div>
  )
}

function AddressInput({ question }: { question: Question }) {
  return (
    <div className="space-y-2">
      {['Straße und Hausnummer', 'Postleitzahl', 'Stadt'].map((placeholder) => (
        <input
          key={placeholder}
          type="text"
          disabled
          placeholder={placeholder}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
        />
      ))}
    </div>
  )
}

function PersonInput({ question }: { question: Question }) {
  return (
    <div className="space-y-2">
      {['Vorname', 'Nachname', 'Geburtsdatum'].map((placeholder) => (
        <input
          key={placeholder}
          type="text"
          disabled
          placeholder={placeholder}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
        />
      ))}
    </div>
  )
}

function BankAccountInput({ question }: { question: Question }) {
  return (
    <div className="space-y-2">
      {['IBAN', 'BIC', 'Bankname'].map((placeholder) => (
        <input
          key={placeholder}
          type="text"
          disabled
          placeholder={placeholder}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm"
        />
      ))}
    </div>
  )
}

function DocumentUploadInput(_props: { question: Question }) {
  return (
    <div className="border-border bg-muted/30 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
      Dokument-Upload (folgt in Meilenstein 4)
    </div>
  )
}

// ── Generic dispatcher ────────────────────────────────────────────────────────

export function QuestionRenderer({
  question,
}: {
  question: Question
}) {
  const opts = question.options

  const input = (() => {
    switch (question.answer_type) {
      case 'short_text':     return <ShortTextInput question={question} />
      case 'long_text':      return <LongTextInput question={question} />
      case 'number':         return <NumberInput question={question} />
      case 'amount':         return <AmountInput question={question} />
      case 'date':           return <DateInput question={question} />
      case 'yes_no':         return <YesNoInput question={question} />
      case 'single_select':  return <SingleSelectInput question={question} options={opts} />
      case 'multi_select':   return <MultiSelectInput question={question} options={opts} />
      case 'address':        return <AddressInput question={question} />
      case 'person':         return <PersonInput question={question} />
      case 'bank_account':   return <BankAccountInput question={question} />
      case 'document_upload':return <DocumentUploadInput question={question} />
      default:               return <ShortTextInput question={question} />
    }
  })()

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium leading-snug">{question.prompt_de}</label>
        {!question.is_required && (
          <span className="text-muted-foreground shrink-0 text-xs">{s.optionalBadge}</span>
        )}
      </div>
      {question.help_de && (
        <p className="text-muted-foreground text-xs">{question.help_de}</p>
      )}
      {input}
    </div>
  )
}
