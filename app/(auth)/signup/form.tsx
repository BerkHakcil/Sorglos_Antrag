'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import type { Value as PhoneValue } from 'react-phone-number-input'
import deLabels from 'react-phone-number-input/locale/de.json'
import 'react-phone-number-input/style.css'
import { ConsentInfoPopover } from '@/components/ui/consent-info-popover'
import { cn } from '@/lib/utils'
import { de } from '@/lib/strings/de'
import { signupAction, type SignupInput, type SignupResultField } from './actions'

const s = de.signup

// ── Zod schema — client-side validation, all German messages ──────────────────
//
// Field names are snake_case to match the HTML name attributes so Playwright
// tests can locate inputs with [name=first_name] etc.

const signupSchema = z.object({
  first_name: z.string().min(1, s.errors.firstNameRequired),
  last_name: z.string().min(1, s.errors.lastNameRequired),
  // Phone arrives as E.164 from react-phone-number-input.
  phone: z
    .string()
    .min(1, s.errors.phoneRequired)
    .refine((v) => isValidPhoneNumber(v), s.errors.phoneInvalid),
  email: z.string().min(1, s.errors.fieldRequired).email(s.errors.emailInvalid),
  password: z.string().min(1, s.errors.fieldRequired).min(8, s.errors.passwordLength),
  consent_datenschutz: z.boolean().refine((v) => v, { message: s.errors.consents }),
  consent_agb: z.boolean().refine((v) => v, { message: s.errors.consents }),
  consent_data_processing: z.boolean().refine((v) => v, { message: s.errors.consents }),
  consent_authority_to_act: z.boolean().refine((v) => v, { message: s.errors.consents }),
} satisfies Record<keyof SignupInput, z.ZodTypeAny>)

// ─────────────────────────────────────────────────────────────────────────────

const inputBase =
  'border-border bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2'

const inputError = 'border-destructive focus:ring-destructive'

export function SignupForm() {
  const [isPending, startTransition] = useTransition()
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      password: '',
      consent_datenschutz: false,
      consent_agb: false,
      consent_data_processing: false,
      consent_authority_to_act: false,
    },
  })

  // Phone value is managed through RHF state; PhoneInput drives it via setValue.
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch is intentionally not memoized; PhoneInput re-renders are acceptable here
  const phoneValue = watch('phone') as PhoneValue | undefined

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await signupAction(data)
      if (result.ok) {
        setShowSuccess(true)
      } else if (result.field === 'root') {
        setError('root', { type: 'server', message: result.error })
      } else {
        setError(result.field as SignupResultField & keyof SignupInput, {
          type: 'server',
          message: result.error,
        })
      }
    })
  })

  if (showSuccess) {
    return (
      <div
        role="status"
        className="border-border bg-muted/50 text-muted-foreground rounded-lg border p-4 text-sm"
      >
        {s.successMessage}
      </div>
    )
  }

  // A consent error can come from Zod (any consent field) or from the server (root).
  const consentErrorMsg =
    errors.root?.message ||
    errors.consent_datenschutz?.message ||
    errors.consent_agb?.message ||
    errors.consent_data_processing?.message ||
    errors.consent_authority_to_act?.message

  return (
    // noValidate disables native HTML5 browser validation bubbles (English messages).
    // All validation is handled by Zod + react-hook-form.
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {/* ── Top-level errors (server generic / rate-limit / consents) ── */}
      {consentErrorMsg && (
        <p role="alert" className="text-destructive text-sm">
          {consentErrorMsg}
        </p>
      )}

      {/* ── Name row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="first_name" className="text-sm font-medium">
            {s.fields.firstName}
          </label>
          <input
            id="first_name"
            type="text"
            autoComplete="given-name"
            className={cn(inputBase, errors.first_name && inputError)}
            aria-describedby={errors.first_name ? 'first_name-error' : undefined}
            aria-invalid={!!errors.first_name}
            {...register('first_name')}
          />
          {errors.first_name && (
            <p id="first_name-error" role="alert" className="text-destructive text-xs">
              {errors.first_name.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="last_name" className="text-sm font-medium">
            {s.fields.lastName}
          </label>
          <input
            id="last_name"
            type="text"
            autoComplete="family-name"
            className={cn(inputBase, errors.last_name && inputError)}
            aria-describedby={errors.last_name ? 'last_name-error' : undefined}
            aria-invalid={!!errors.last_name}
            {...register('last_name')}
          />
          {errors.last_name && (
            <p id="last_name-error" role="alert" className="text-destructive text-xs">
              {errors.last_name.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Phone ────────────────────────────────────────── */}
      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium">
          {s.fields.phone}
        </label>
        {/*
          PhoneInput drives RHF via setValue; its underlying <input> has no
          name attribute and is NOT submitted. The server action receives the
          E.164 value directly from the SignupInput object.
        */}
        <PhoneInput
          id="phone"
          labels={deLabels}
          international
          defaultCountry="DE"
          value={phoneValue}
          onChange={(val) =>
            setValue('phone', val ?? '', {
              shouldValidate: !!errors.phone,
              shouldDirty: true,
            })
          }
          aria-describedby={errors.phone ? 'phone-error' : undefined}
          aria-invalid={!!errors.phone}
          className={cn(
            'flex w-full items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-2',
            errors.phone
              ? 'border-destructive focus-within:ring-destructive'
              : 'border-border focus-within:ring-ring'
          )}
          numberInputProps={{
            'data-testid': 'phone-input',
            className: 'flex-1 bg-transparent px-3 py-2 text-sm outline-none',
          }}
          countrySelectProps={{
            className:
              'border-border bg-background self-stretch cursor-pointer border-r px-2 text-sm outline-none',
          }}
        />
        {errors.phone && (
          <p id="phone-error" role="alert" className="text-destructive text-xs">
            {errors.phone.message}
          </p>
        )}
      </div>

      {/* ── Email ────────────────────────────────────────── */}
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          {s.fields.email}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={cn(inputBase, errors.email && inputError)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-destructive text-xs">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* ── Password ─────────────────────────────────────── */}
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          {s.fields.password}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={cn(inputBase, errors.password && inputError)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password ? (
          <p id="password-error" role="alert" className="text-destructive text-xs">
            {errors.password.message}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{s.fields.passwordHint}</p>
        )}
      </div>

      {/* ── Consents ─────────────────────────────────────── */}
      <div className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
        {/* 1 — Datenschutz */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 h-4 w-4 shrink-0"
            {...register('consent_datenschutz')}
          />
          <span className="text-sm leading-snug">
            {s.consents.datenschutz.prefix}
            <Link href="/datenschutz" className="underline underline-offset-2" target="_blank">
              {s.consents.datenschutz.linkText}
            </Link>
            {s.consents.datenschutz.suffix}
          </span>
        </label>

        {/* 2 — AGB */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 h-4 w-4 shrink-0"
            {...register('consent_agb')}
          />
          <span className="text-sm leading-snug">
            {s.consents.agb.prefix}
            <Link href="/agb" className="underline underline-offset-2" target="_blank">
              {s.consents.agb.linkText}
            </Link>
            {s.consents.agb.suffix}
          </span>
        </label>

        {/* 3 — Data processing */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 h-4 w-4 shrink-0"
            {...register('consent_data_processing')}
          />
          <span className="inline-flex flex-wrap items-baseline gap-x-0 text-sm leading-snug">
            {s.consents.dataProcessing.label}
            <ConsentInfoPopover
              info={s.consents.dataProcessing.infoText}
              triggerLabel={s.consents.dataProcessing.infoTriggerLabel}
            />
          </span>
        </label>

        {/* 4 — Authority to act */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 h-4 w-4 shrink-0"
            {...register('consent_authority_to_act')}
          />
          <span className="inline-flex flex-wrap items-baseline gap-x-0 text-sm leading-snug">
            {s.consents.authorityToAct.label}
            <ConsentInfoPopover
              info={s.consents.authorityToAct.infoText}
              triggerLabel={s.consents.authorityToAct.infoTriggerLabel}
            />
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? s.submitPending : s.submitIdle}
      </button>

      <p className="text-muted-foreground text-center text-sm">
        {s.haveAccount}{' '}
        <Link href="/login" className="hover:text-foreground underline underline-offset-4">
          {s.loginLink}
        </Link>
      </p>
    </form>
  )
}
