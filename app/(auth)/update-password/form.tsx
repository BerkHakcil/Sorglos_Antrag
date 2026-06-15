'use client'

import { useActionState } from 'react'
import { de } from '@/lib/strings/de'
import { updatePasswordAction, type UpdatePasswordState } from './actions'

const up = de.updatePassword

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState<UpdatePasswordState, FormData>(
    updatePasswordAction,
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
        <label htmlFor="password" className="text-sm font-medium">
          {up.newPasswordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        <p className="text-muted-foreground text-xs">{up.passwordHint}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium">
          {up.confirmPasswordLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? up.submitPending : up.submitIdle}
      </button>
    </form>
  )
}
