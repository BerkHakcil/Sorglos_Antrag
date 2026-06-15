import { LoginForm } from './form'

export const metadata = { title: 'Anmelden – Hilfe zur Pflege' }

export default function LoginPage() {
  return (
    <div className="border-border bg-card space-y-6 rounded-xl border p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="text-muted-foreground text-sm">
          Melden Sie sich an, um Ihren Antrag fortzusetzen.
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
