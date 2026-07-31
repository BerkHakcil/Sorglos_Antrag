import { de } from '@/lib/strings/de'
import { SignupForm } from './form'
import { cardLg } from '@/components/ui/styles'

const s = de.signup

export const metadata = { title: s.pageTitle }

export default function SignupPage() {
  return (
    <div className={`${cardLg} space-y-6 p-6 sm:p-8`}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.heading}</h1>
        <p className="text-graphite-soft text-base leading-relaxed">{s.subheading}</p>
      </div>
      <SignupForm />
    </div>
  )
}
