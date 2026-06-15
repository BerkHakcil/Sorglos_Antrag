'use client'

import { useTransition, useState } from 'react'
import { de } from '@/lib/strings/de'
import { saveCareHomeAction } from './actions'

const s = de.case.careHome

type CareHome = { id: string; name: string; address: string | null }

export function CareHomeSelector({ careHomes }: { careHomes: CareHome[] }) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await saveCareHomeAction(selected)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{s.heading}</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="care_home_id" className="text-sm font-medium">
            {s.label}
          </label>
          <select
            id="care_home_id"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            required
          >
            <option value="" disabled>
              {s.placeholder}
            </option>
            {careHomes.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
                {ch.address ? ` – ${ch.address}` : ''}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !selected}
          className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? s.loadingButton : s.submitButton}
        </button>
      </form>
    </section>
  )
}
