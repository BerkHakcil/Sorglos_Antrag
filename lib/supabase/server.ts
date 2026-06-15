import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Returns a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses the publishable key — RLS policies limit access
 * to what the authenticated user owns.
 *
 * The try/catch in setAll is intentional: Server Components cannot set cookies
 * (only proxy.ts can). Errors there are silent because the proxy has already
 * refreshed the session before this render; the setAll call is a no-op in that
 * context.
 *
 * After calling createClient(), always verify identity with getClaims() before
 * reading or writing case data — do not rely on RLS alone.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Intentionally silent: see JSDoc above.
          }
        },
      },
    }
  )
}

/**
 * Returns a Supabase client that uses the secret key and bypasses RLS.
 * Use ONLY in trusted server-side code (e.g. a Postgres trigger fallback,
 * admin seeding, or the one-case-per-user enforcement on signup).
 * Never expose this client to the browser.
 */
export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Intentionally silent.
          }
        },
      },
    }
  )
}
