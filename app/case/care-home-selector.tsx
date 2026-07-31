'use client'

import { useTransition, useState } from 'react'
import { de } from '@/lib/strings/de'
import { saveCareHomeAction } from './actions'
import { btnCopper, controlFull, fieldLabel } from '@/components/ui/styles'

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
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">{s.heading}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="care_home_id" className={fieldLabel}>
            {s.label}
          </label>
          <select
            id="care_home_id"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={controlFull}
            required
          >
            <option value="" disabled>
              {s.placeholder}
            </option>
            {careHomes.map((ch) => (
              /* Facility name only — the full address stays in the DB. */
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending || !selected} className={`${btnCopper} w-full`}>
          {isPending ? s.loadingButton : s.submitButton}
        </button>
      </form>
    </section>
  )
}
