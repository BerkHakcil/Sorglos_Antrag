'use server'

import { createClient } from '@/lib/supabase/server'
import { de } from '@/lib/strings/de'
import { headers } from 'next/headers'

export type ResetPasswordState = { error?: string; success?: string } | undefined

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const email = formData.get('email') as string
  const rp = de.resetPassword

  if (!email) {
    return { error: rp.errors.emailRequired }
  }

  // NEXT_PUBLIC_SITE_URL is set on Vercel; fall back to the request origin in dev.
  const headersList = await headers()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headersList.get('origin') ??
    'http://localhost:3000'
  const redirectTo = `${siteUrl}/auth/callback?next=/update-password`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    return { error: rp.errors.generic }
  }

  // Always return success to avoid email enumeration.
  return { success: rp.successMessage }
}
