'use client'

import { useTransition, useState } from 'react'
import { de } from '@/lib/strings/de'
import { resolvePlzAction } from './actions'

const s = de.case.plz
const PLZ_RE = /^\d{5}$/

export function PlzForm() {
  const [isPending, startTransition] = useTransition()
  const [plz, setPlz] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = plz.trim()
    if (!PLZ_RE.test(value)) {
      setError(s.errorInvalidFormat)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await resolvePlzAction(value)
      if (!result.ok) setError(result.error)
      // On success the page re-renders from server (revalidatePath); no local
      // state change needed. The 'unsupported' notice is shown via caseData.
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{s.heading}</h2>
      <p className="text-muted-foreground text-sm">{s.description}</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="plz_input" className="text-sm font-medium">
            {s.label}
          </label>
          <input
            id="plz_input"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={plz}
            onChange={(e) => setPlz(e.target.value)}
            placeholder={s.placeholder}
            className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? s.loadingButton : s.submitButton}
        </button>
      </form>
    </section>
  )
}
