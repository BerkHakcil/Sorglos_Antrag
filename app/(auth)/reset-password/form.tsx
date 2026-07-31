'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { de } from '@/lib/strings/de'
import { resetPasswordAction, type ResetPasswordState } from './actions'
import {
  btnCopper,
  controlFull,
  fieldLabel,
  linkPetrol,
  linkStandalone,
} from '@/components/ui/styles'

const rp = de.resetPassword

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    undefined
  )

  if (state?.success) {
    return (
      <div className="space-y-4">
        {/* E-5: same sage info panel as the signup confirmation — both are
            "we've sent you an email" outcomes and should look alike. */}
        <p
          role="status"
          className="border-sage-soft/70 bg-sage-soft/40 text-foreground rounded-xl border p-4 text-sm leading-relaxed"
        >
          {state.success}
        </p>
        <Link href="/login" className={`${linkPetrol} ${linkStandalone} justify-center text-sm`}>
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
        <label htmlFor="email" className={fieldLabel}>
          {rp.emailLabel}
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

      <button type="submit" disabled={isPending} className={`${btnCopper} w-full`}>
        {isPending ? rp.submitPending : rp.submitIdle}
      </button>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className={`${linkPetrol} ${linkStandalone}`}>
          {rp.backToLogin}
        </Link>
      </p>
    </form>
  )
}
