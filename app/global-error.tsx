'use client'

// Catches render errors that escape all nested error boundaries.
// Shows a friendly German page instead of the default white crash screen.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f9fafb',
        }}
      >
        <div style={{ maxWidth: '30rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
            Ein Fehler ist aufgetreten
          </h1>
          <p style={{ color: '#555', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Es tut uns leid. Bitte laden Sie die Seite neu oder versuchen Sie es in Kürze erneut.
            Falls das Problem anhält, wenden Sie sich bitte an unseren Support.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
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
