import { de } from '@/lib/strings/de'
import { ResetPasswordForm } from './form'
import { cardLg } from '@/components/ui/styles'

const rp = de.resetPassword

export const metadata = { title: rp.pageTitle }

export default function ResetPasswordPage() {
  return (
    <div className={`${cardLg} space-y-6 p-8`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{rp.heading}</h1>
        <p className="text-muted-foreground text-sm">{rp.subheading}</p>
      </div>
      <ResetPasswordForm />
    </div>
  )
}
