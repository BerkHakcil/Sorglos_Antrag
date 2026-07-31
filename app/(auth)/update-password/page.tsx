import { de } from '@/lib/strings/de'
import { UpdatePasswordForm } from './form'
import { cardLg } from '@/components/ui/styles'

const up = de.updatePassword

export const metadata = { title: up.pageTitle }

export default function UpdatePasswordPage() {
  return (
    <div className={`${cardLg} space-y-6 p-8`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{up.heading}</h1>
        <p className="text-muted-foreground text-sm">{up.subheading}</p>
      </div>
      <UpdatePasswordForm />
    </div>
  )
}
