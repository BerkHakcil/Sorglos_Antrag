'use server'

import { createClient } from '@/lib/supabase/server'
import { de } from '@/lib/strings/de'
import { redirect } from 'next/navigation'

export type LoginState = { error?: string } | undefined

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-Mail und Passwort sind erforderlich.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: de.login.errors.emailNotConfirmed }
    }
    return { error: 'E-Mail oder Passwort ist falsch.' }
  }

  redirect('/case')
}
