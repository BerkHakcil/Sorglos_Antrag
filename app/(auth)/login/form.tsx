'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { loginAction, type LoginState } from './actions'
import { AUTOSAVE_NOTICE_DISMISSED_KEY } from '@/lib/autosave-notice'
import {
  btnCopper,
  controlFull,
  fieldLabel,
  linkPetrol,
  linkStandalone,
} from '@/components/ui/styles'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  )

  // R7 (mobile round 3): reaching the login page starts a fresh "login
  // session" for the autosave notice — clearing the dismissal flag here is
  // what makes the notice show again "on every login" (incl. logout → login
  // in the same tab) while staying pure client state.
  useEffect(() => {
    try {
      sessionStorage.removeItem(AUTOSAVE_NOTICE_DISMISSED_KEY)
    } catch {
      /* storage unavailable → nothing to clear */
    }
  }, [])

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className={fieldLabel}>
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={controlFull}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className={fieldLabel}>
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={controlFull}
        />
      </div>

      <button type="submit" disabled={isPending} className={`${btnCopper} w-full`}>
        {isPending ? 'Anmelden…' : 'Anmelden'}
      </button>

      <div className="flex justify-between text-sm">
        <Link href="/signup" className={`${linkPetrol} ${linkStandalone}`}>
          Registrieren
        </Link>
        <Link href="/reset-password" className={`${linkPetrol} ${linkStandalone}`}>
          Passwort vergessen?
        </Link>
      </div>
    </form>
  )
}
