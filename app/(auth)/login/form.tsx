'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction, type LoginState } from './actions'
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
