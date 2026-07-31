import { de } from '@/lib/strings/de'
import { SignupForm } from './form'
import { cardLg } from '@/components/ui/styles'

const s = de.signup

export const metadata = { title: s.pageTitle }

export default function SignupPage() {
  return (
    <div className={`${cardLg} space-y-6 p-8`}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{s.heading}</h1>
        <p className="text-muted-foreground text-sm">{s.subheading}</p>
      </div>
      <SignupForm />
    </div>
  )
}
