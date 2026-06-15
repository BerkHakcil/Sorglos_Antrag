'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { de } from '@/lib/strings/de'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const rp = de.resetPassword

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    undefined
  )

  if (state?.success) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="border-border bg-muted/50 text-muted-foreground rounded-lg border p-4 text-sm"
        >
          {state.success}
        </p>
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground block text-center text-sm underline underline-offset-4"
        >
          {rp.backToLogin}
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          {rp.emailLabel}
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

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? rp.submitPending : rp.submitIdle}
      </button>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="hover:text-foreground underline underline-offset-4">
          {rp.backToLogin}
        </Link>
      </p>
    </form>
  )
}
