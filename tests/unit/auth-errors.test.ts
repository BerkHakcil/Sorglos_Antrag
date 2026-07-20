import { describe, it, expect } from 'vitest'
import { mapSupabaseError } from '@/lib/auth-errors'
import { de } from '@/lib/strings/de'

const e = de.signup.errors

describe('mapSupabaseError — structured GoTrue error codes', () => {
  it('maps user_already_exists to the email-taken message on the email field', () => {
    expect(
      mapSupabaseError({ code: 'user_already_exists', message: 'User already registered' })
    ).toEqual({
      field: 'email',
      error: e.emailTaken,
    })
  })

  it('maps email_exists to the email-taken message', () => {
    expect(
      mapSupabaseError({ code: 'email_exists', message: 'Email address already exists' }).error
    ).toBe(e.emailTaken)
  })

  it('maps email_address_invalid to the invalid-email message', () => {
    expect(
      mapSupabaseError({ code: 'email_address_invalid', message: 'Email address is invalid' })
    ).toEqual({
      field: 'email',
      error: e.emailInvalid,
    })
  })

  it('maps weak_password to the password-length message on the password field', () => {
    expect(mapSupabaseError({ code: 'weak_password', message: 'Password is too weak' })).toEqual({
      field: 'password',
      error: e.passwordLength,
    })
  })

  it('maps both rate-limit codes to the rate-limit message', () => {
    expect(
      mapSupabaseError({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })
        .error
    ).toBe(e.rateLimitError)
    expect(
      mapSupabaseError({ code: 'over_request_rate_limit', message: 'Request rate limit reached' })
        .error
    ).toBe(e.rateLimitError)
  })
})

describe('mapSupabaseError — SMTP send failure (2026-07-20 incident)', () => {
  // GoTrue reports SMTP failures as code "unexpected_failure" — too generic to
  // key on alone — with message "Error sending confirmation email". Before this
  // mapping existed, the failure collapsed into the generic message.
  it('maps the exact incident error to emailSendFailure, not generic', () => {
    const mapped = mapSupabaseError({
      code: 'unexpected_failure',
      message: 'Error sending confirmation email',
    })
    expect(mapped).toEqual({ field: 'root', error: e.emailSendFailure })
  })

  it('matches other send-failure phrasings (invite, magic link)', () => {
    expect(mapSupabaseError({ message: 'Error sending invite email' }).error).toBe(
      e.emailSendFailure
    )
    expect(mapSupabaseError({ message: 'Error sending magic link email' }).error).toBe(
      e.emailSendFailure
    )
  })
})

describe('mapSupabaseError — message-substring fallbacks (no code)', () => {
  it('maps "already registered" messages', () => {
    expect(mapSupabaseError({ message: 'User already registered' }).error).toBe(e.emailTaken)
  })

  it('maps invalid-email messages', () => {
    expect(
      mapSupabaseError({ message: 'Unable to validate email address: invalid format' }).error
    ).toBe(e.emailInvalid)
  })

  it('maps short-password messages', () => {
    expect(mapSupabaseError({ message: 'Password should be at least 8 characters' }).error).toBe(
      e.passwordLength
    )
  })

  it('maps rate-limit messages', () => {
    expect(mapSupabaseError({ message: 'email rate limit exceeded' }).error).toBe(e.rateLimitError)
  })

  it('falls back to the generic message for unknown errors', () => {
    expect(
      mapSupabaseError({ code: 'unexpected_failure', message: 'Database error saving new user' })
    ).toEqual({
      field: 'root',
      error: e.generic,
    })
  })
})
