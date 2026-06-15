'use server'

import { createClient } from '@/lib/supabase/server'
import { de } from '@/lib/strings/de'
import { redirect } from 'next/navigation'

export type UpdatePasswordState = { error?: string } | undefined

export async function updatePasswordAction(
  _prev: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  const up = de.updatePassword.errors

  if (!password || !confirm) {
    return { error: up.allRequired }
  }
  if (password.length < 8) {
    return { error: up.passwordLength }
  }
  if (password !== confirm) {
    return { error: up.passwordMismatch }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: up.generic }
  }

  redirect('/case')
}
