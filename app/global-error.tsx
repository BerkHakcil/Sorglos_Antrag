'use client'

// Catches render errors that escape all nested error boundaries.
// Shows a friendly German page instead of the default white crash screen.
//
// E-7: brought onto the brand palette. The styles stay INLINE on purpose —
// global-error replaces the root layout, so app/globals.css is not loaded and
// no Tailwind class or CSS variable resolves here. Every value is therefore
// the literal token value, kept in sync by hand:
//   cream #f7f4ed page · white #ffffff card · graphite #2c2f32 heading ·
//   graphite-soft #5c6166 body · petrol #245b5a action.
// The action button is PETROL, not copper: copper is the "get on with your
// application" call to action, and this page is not that. It is also not
// --destructive — the semantic rule reserves red for a genuine error state
// the user caused or must resolve, and a crash we caused is neither.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: 'Lato, system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f7f4ed',
        }}
      >
        <div style={{ maxWidth: '30rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: '#2c2f32',
            }}
          >
            Ein Fehler ist aufgetreten
          </h1>
          <p style={{ color: '#5c6166', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Es tut uns leid. Bitte laden Sie die Seite neu oder versuchen Sie es in Kürze erneut.
            Falls das Problem anhält, wenden Sie sich bitte an unseren Support.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#245b5a',
              color: '#fff',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Seite neu laden
          </button>
        </div>
      </body>
    </html>
  )
}
