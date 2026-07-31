'use client'

import { useActionState } from 'react'
import { de } from '@/lib/strings/de'
import { updatePasswordAction, type UpdatePasswordState } from './actions'
import { btnCopper, controlFull, fieldLabel } from '@/components/ui/styles'

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
        <label htmlFor="password" className={fieldLabel}>
          {up.newPasswordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={controlFull}
        />
        <p className="text-muted-foreground text-xs">{up.passwordHint}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className={fieldLabel}>
          {up.confirmPasswordLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className={controlFull}
        />
      </div>

      <button type="submit" disabled={isPending} className={`${btnCopper} w-full`}>
        {isPending ? up.submitPending : up.submitIdle}
      </button>
    </form>
  )
}
