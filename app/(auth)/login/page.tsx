import { LoginForm } from './form'
import { cardLg } from '@/components/ui/styles'

export const metadata = { title: 'Anmelden – Hilfe zur Pflege' }

export default function LoginPage() {
  return (
    <div className={`${cardLg} space-y-6 p-6 sm:p-8`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Willkommen zurück</h1>
        <p className="text-graphite-soft text-base leading-relaxed">
          Melden Sie sich an, um Ihren Antrag fortzusetzen.
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
