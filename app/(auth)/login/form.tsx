'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction, type LoginState } from './actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  )

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Anmelden…' : 'Anmelden'}
      </button>

      <div className="text-muted-foreground flex justify-between text-sm">
        <Link href="/signup" className="hover:text-foreground underline underline-offset-4">
          Registrieren
        </Link>
        <Link href="/reset-password" className="hover:text-foreground underline underline-offset-4">
          Passwort vergessen?
        </Link>
      </div>
    </form>
  )
}
