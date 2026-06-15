import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Next.js 16 Proxy (equivalent to middleware.ts in Next.js 15).
 *
 * Runs on every matched request BEFORE the page renders.
 * Its job here is purely to refresh the Supabase session:
 *
 *   1. Creates a server client wired to the request's cookies.
 *   2. Calls getClaims() — if the JWT is expired, @supabase/ssr automatically
 *      exchanges the refresh token for a new access token and calls setAll().
 *   3. setAll() writes the fresh cookies onto both the request (so Server
 *      Components see the new token in this same render) and the response
 *      (so the browser receives updated cookies).
 *
 * Route-level auth checks (redirect unauthenticated → /login) live in
 * lib/dal.ts (verifySession), called from each protected Server Component.
 * This separation keeps the proxy fast — it never hits the database.
 *
 * Security note: getClaims() validates the JWT signature against Supabase's
 * published public keys locally. It does NOT call the Auth server on every
 * request — only when a refresh is needed.
 */
export async function proxy(request: NextRequest) {
  // We mutate supabaseResponse inside setAll so cookies are mirrored
  // onto both the forwarded request and the final response.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Write to request so downstream Server Components see fresh token.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Re-create response to pick up the modified request headers.
          supabaseResponse = NextResponse.next({ request })
          // Write to response so the browser receives the refreshed cookies.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session. If the access token is still valid this is a fast
  // local JWT decode. If it's expired the library uses the refresh token.
  await supabase.auth.getClaims()

  return supabaseResponse
}

// Run the proxy on all routes except Next.js internals and static files.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
