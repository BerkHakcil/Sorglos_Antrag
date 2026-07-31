import { de } from '@/lib/strings/de'
import { ResetPasswordForm } from './form'
import { cardLg } from '@/components/ui/styles'

const rp = de.resetPassword

export const metadata = { title: rp.pageTitle }

export default function ResetPasswordPage() {
  return (
    <div className={`${cardLg} space-y-6 p-6 sm:p-8`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{rp.heading}</h1>
        <p className="text-graphite-soft text-base leading-relaxed">{rp.subheading}</p>
      </div>
      <ResetPasswordForm />
    </div>
  )
}
