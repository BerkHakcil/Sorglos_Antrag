/**
 * Generic question renderer — dispatches on answer_type.
 *
 * Two modes:
 *   Read-only  (M2 / chat history): pass no onChange — inputs are disabled.
 *   Interactive (M3 chat):          pass onChange + value — inputs are enabled, controlled.
 *
 * Adding a new answer type = one new case in the switch + one new component. No other changes.
 */
'use client'

import type { Question, QuestionOption } from '@/lib/questionnaire-types'
import { de } from '@/lib/strings/de'

const s = de.case.questionnaire
const sc = de.case.chat

// ── Shared props type ─────────────────────────────────────────────────────────

type InputProps = {
  question: Question
  value?: unknown
  onChange?: (value: unknown) => void
  /** Called when the user presses Enter (or Shift+Enter for long_text) to advance. */
  onSubmit?: () => void
}

// ── Individual input components ───────────────────────────────────────────────

function ShortTextInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <input
      type="text"
      disabled={!onChange}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
    />
  )
}

function LongTextInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <div className="space-y-1">
      <textarea
        disabled={!onChange}
        rows={3}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            onSubmit?.()
          }
        }}
        aria-label={question.prompt_de}
        className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
      />
      {onSubmit && (
        <p className="text-muted-foreground text-xs">{sc.longTextHint}</p>
      )}
    </div>
  )
}

function NumberInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <input
      type="number"
      disabled={!onChange}
      value={value !== null && value !== undefined && value !== '' ? String(value) : ''}
      onChange={(e) => onChange?.(e.target.value === '' ? '' : parseFloat(e.target.value))}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
    />
  )
}

function AmountInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        disabled={!onChange}
        step="0.01"
        value={value !== null && value !== undefined && value !== '' ? String(value) : ''}
        onChange={(e) => onChange?.(e.target.value === '' ? '' : parseFloat(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
        aria-label={question.prompt_de}
        className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
      />
      <span className="text-muted-foreground shrink-0 text-sm">€</span>
    </div>
  )
}

function DateInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <input
      type="date"
      disabled={!onChange}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
    />
  )
}

function YesNoInput({ question, value, onChange, onSubmit }: InputProps) {
  return (
    <div
      className="flex gap-4"
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
    >
      {(['Ja', 'Nein'] as const).map((opt) => (
        <label
          key={opt}
          className={`flex items-center gap-2 text-sm ${onChange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        >
          <input
            type="radio"
            disabled={!onChange}
            name={`yn-${question.id}`}
            value={opt}
            checked={value === opt}
            onChange={() => onChange?.(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

function SingleSelectInput({
  question,
  options,
  value,
  onChange,
  onSubmit,
}: InputProps & { options: QuestionOption[] }) {
  return (
    <select
      disabled={!onChange}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
      aria-label={question.prompt_de}
      className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
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
  options,
  value,
  onChange,
}: InputProps & { options: QuestionOption[] }) {
  const selected = Array.isArray(value) ? (value as string[]) : []
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]
    onChange?.(next)
  }

  return (
    <div className="space-y-1">
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex items-center gap-2 text-sm ${onChange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        >
          <input
            type="checkbox"
            disabled={!onChange}
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
            value={o.value}
          />
          {o.label_de}
        </label>
      ))}
    </div>
  )
}

function AddressInput({ question, value, onChange, onSubmit }: InputProps) {
  const addr = (value as Record<string, string> | null | undefined) ?? {}
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange?.({ ...addr, [field]: e.target.value })

  return (
    <div className="space-y-2">
      {[
        { field: 'street', placeholder: 'Straße und Hausnummer' },
        { field: 'plz', placeholder: 'Postleitzahl' },
        { field: 'city', placeholder: 'Stadt' },
      ].map(({ field, placeholder }) => (
        <input
          key={field}
          type="text"
          disabled={!onChange}
          placeholder={placeholder}
          value={addr[field] ?? ''}
          onChange={update(field)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
        />
      ))}
    </div>
  )
}

function PersonInput({ question, value, onChange, onSubmit }: InputProps) {
  const person = (value as Record<string, string> | null | undefined) ?? {}
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange?.({ ...person, [field]: e.target.value })

  return (
    <div className="space-y-2">
      {[
        { field: 'first_name', placeholder: 'Vorname', type: 'text' },
        { field: 'last_name', placeholder: 'Nachname', type: 'text' },
        { field: 'birth_date', placeholder: 'Geburtsdatum', type: 'date' },
      ].map(({ field, placeholder, type }) => (
        <input
          key={field}
          type={type}
          disabled={!onChange}
          placeholder={placeholder}
          value={person[field] ?? ''}
          onChange={update(field)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
        />
      ))}
    </div>
  )
}

function BankAccountInput({ question, value, onChange, onSubmit }: InputProps) {
  const bank = (value as Record<string, string> | null | undefined) ?? {}
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange?.({ ...bank, [field]: e.target.value })

  return (
    <div className="space-y-2">
      {[
        { field: 'iban', placeholder: 'IBAN' },
        { field: 'bic', placeholder: 'BIC (optional)' },
        { field: 'bank_name', placeholder: 'Bankname (optional)' },
      ].map(({ field, placeholder }) => (
        <input
          key={field}
          type="text"
          disabled={!onChange}
          placeholder={placeholder}
          value={bank[field] ?? ''}
          onChange={update(field)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.() } }}
          aria-label={`${question.prompt_de} – ${placeholder}`}
          className="border-border bg-muted/30 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
        />
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DocumentUploadInput(_props: InputProps) {
  return (
    <div className="border-border bg-muted/30 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
      Dokument-Upload (folgt in Meilenstein 4)
    </div>
  )
}

// ── Generic dispatcher ────────────────────────────────────────────────────────

export function QuestionRenderer({
  question,
  value,
  onChange,
  onSubmit,
}: {
  question: Question
  /** Current answer value. Undefined = no value (read-only / not yet answered). */
  value?: unknown
  /** When provided, renders in interactive mode. When absent, renders disabled (read-only). */
  onChange?: (value: unknown) => void
  /** Called when Enter is pressed in applicable inputs to advance to the next question. */
  onSubmit?: () => void
}) {
  const opts = question.options

  const input = (() => {
    switch (question.answer_type) {
      case 'short_text':      return <ShortTextInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'long_text':       return <LongTextInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'number':          return <NumberInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'amount':          return <AmountInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'date':            return <DateInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'yes_no':          return <YesNoInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'single_select':   return <SingleSelectInput question={question} options={opts} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'multi_select':    return <MultiSelectInput question={question} options={opts} value={value} onChange={onChange} />
      case 'address':         return <AddressInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'person':          return <PersonInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'bank_account':    return <BankAccountInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      case 'document_upload': return <DocumentUploadInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
      default:                return <ShortTextInput question={question} value={value} onChange={onChange} onSubmit={onSubmit} />
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
