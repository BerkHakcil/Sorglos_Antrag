import { de } from '@/lib/strings/de'

// Lives outside the signup actions file because 'use server' modules may only
// export async functions — and this pure mapper must be unit-testable
// (tests/unit/auth-errors.test.ts).

export type SignupErrorField = 'email' | 'password' | 'root'

export type MappedSignupError = { field: SignupErrorField; error: string }

// The subset of supabase-js AuthError we map from. `code` is GoTrue's stable
// machine-readable error_code (e.g. "user_already_exists"); `message` is the
// human-readable English text. Codes are preferred; message substrings remain
// as fallback for older GoTrue responses that omit the code.
export type SupabaseAuthErrorLike = {
  code?: string
  message: string
}

export function mapSupabaseError(err: SupabaseAuthErrorLike): MappedSignupError {
  const m = err.message.toLowerCase()
  const e = de.signup.errors

  // ── Structured error codes first ──
  switch (err.code) {
    case 'user_already_exists':
    case 'email_exists':
      return { field: 'email', error: e.emailTaken }
    case 'email_address_invalid':
      return { field: 'email', error: e.emailInvalid }
    case 'weak_password':
      return { field: 'password', error: e.passwordLength }
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return { field: 'root', error: e.rateLimitError }
  }

  // ── Message fallbacks ──
  // SMTP failure surfaces as code "unexpected_failure" with message
  // "Error sending confirmation email" — only the message identifies it
  // (2026-07-20 incident: Brevo 535 collapsed into the generic error and
  // cost real debugging time).
  if (m.includes('error sending')) {
    return { field: 'root', error: e.emailSendFailure }
  }
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
  if (
    m.includes('password') &&
    (m.includes('short') || m.includes('weak') || m.includes('least'))
  ) {
    return { field: 'password', error: e.passwordLength }
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('to many requests')) {
    return { field: 'root', error: e.rateLimitError }
  }

  return { field: 'root', error: e.generic }
}
