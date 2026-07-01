'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { de } from '@/lib/strings/de'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
// libphonenumber-js/min is the server-safe validation lib; importing from
// react-phone-number-input here would pull its React component into the SSR
// bundle, causing "Super expression must either be null or a function" at
// module evaluation time on Vercel.
import { isValidPhoneNumber } from 'libphonenumber-js/min'

// ── Shared types (imported as `type` in form.tsx) ─────────────────────────────

export type SignupInput = {
  first_name: string
  last_name: string
  phone: string
  email: string
  password: string
  consent_datenschutz: boolean
  consent_agb: boolean
  consent_data_processing: boolean
  consent_authority_to_act: boolean
}

// 'root' → form-level banner (rate limit, generic, consents).
// Other keys → shown inline below the matching field.
export type SignupResultField =
  | keyof Omit<
      SignupInput,
      | 'consent_datenschutz'
      | 'consent_agb'
      | 'consent_data_processing'
      | 'consent_authority_to_act'
    >
  | 'root'

export type SignupResult = { ok: true } | { ok: false; field: SignupResultField; error: string }

// ── Supabase Auth error → German message ──────────────────────────────────────

function mapSupabaseError(message: string): { field: SignupResultField; error: string } {
  const m = message.toLowerCase()
  const e = de.signup.errors

  if (m.includes('already registered') || m.includes('already been registered')) {
    return { field: 'email', error: e.emailTaken }
  }
  if (
    m.includes('unable to validate email') ||
    m.includes('valid email') ||
    (m.includes('invalid') && m.includes('email'))
  ) {
    return { field: 'email', error: e.emailInvalid }
  }
  if (m.includes('password') && (m.includes('short') || m.includes('weak') || m.includes('least'))) {
    return { field: 'password', error: e.passwordLength }
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('to many requests')) {
    return { field: 'root', error: e.rateLimitError }
  }

  return { field: 'root', error: e.generic }
}

// ── Server-side validation ─────────────────────────────────────────────────────

// Basic email syntax; Supabase does the authoritative check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const e = de.signup.errors

  // Field validation — checked in form order so the first visible error shows.
  if (!input.first_name?.trim()) return { ok: false, field: 'first_name', error: e.firstNameRequired }
  if (!input.last_name?.trim())  return { ok: false, field: 'last_name',  error: e.lastNameRequired }
  if (!input.phone)              return { ok: false, field: 'phone',       error: e.phoneRequired }
  // isValidPhoneNumber uses libphonenumber-js — same library as the client-side check.
  if (!isValidPhoneNumber(input.phone)) return { ok: false, field: 'phone', error: e.phoneInvalid }
  if (!input.email || !EMAIL_RE.test(input.email)) return { ok: false, field: 'email', error: e.emailInvalid }
  if (!input.password || input.password.length < 8) return { ok: false, field: 'password', error: e.passwordLength }
  if (
    !input.consent_datenschutz ||
    !input.consent_agb ||
    !input.consent_data_processing ||
    !input.consent_authority_to_act
  ) {
    return { ok: false, field: 'root', error: e.consents }
  }

  try {
    // Build the confirmation-email redirect URL.
    // NEXT_PUBLIC_SITE_URL is set on Vercel; falls back to the request origin in dev.
    const headersList = await headers()
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      headersList.get('origin') ??
      'http://localhost:3000'
    const emailRedirectTo = `${siteUrl}/auth/callback`

    const supabase = await createClient()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { first_name: input.first_name.trim(), last_name: input.last_name.trim() },
        emailRedirectTo,
      },
    })

    if (signUpError) {
      const mapped = mapSupabaseError(signUpError.message)
      return { ok: false, ...mapped }
    }

    if (!signUpData.user) {
      return { ok: false, field: 'root', error: e.generic }
    }

    // Store GDPR consent timestamps via admin client.
    // Uses the secret key (SUPABASE_SECRET_KEY) to bypass RLS — the profile row
    // was just inserted by the DB trigger and the user's JWT isn't in the session
    // yet when email confirmation is enabled.
    const now = new Date().toISOString()
    const adminClient = createAdminClient()
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        phone: input.phone,
        consent_datenschutz_at: now,
        consent_agb_at: now,
        consent_data_processing_at: now,
        consent_authority_to_act_at: now,
      })
      .eq('id', signUpData.user.id)

    if (updateError) {
      // Log server-side so the error appears in Vercel function logs.
      console.error('[signupAction] profile update failed:', updateError.message)
      // The user was created in Supabase Auth — return generic error so they can
      // retry; Supabase will surface "already registered" on the next attempt,
      // at which point the admin has time to fix the env var / schema issue.
      return { ok: false, field: 'root', error: e.generic }
    }

    if (signUpData.session) {
      redirect('/case')
    }

    // Email confirmation is required — session not returned yet.
    return { ok: true }
  } catch (err) {
    // Catches unhandled errors (e.g. SUPABASE_SECRET_KEY missing in Vercel,
    // network timeouts) so the user always sees a German message, never the
    // white Next.js "A server error occurred" page.
    console.error('[signupAction] unexpected error:', err)
    return { ok: false, field: 'root', error: e.generic }
  }
}
