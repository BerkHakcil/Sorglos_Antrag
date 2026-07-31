import { de } from '@/lib/strings/de'
import { UpdatePasswordForm } from './form'
import { cardLg } from '@/components/ui/styles'

const up = de.updatePassword

export const metadata = { title: up.pageTitle }

export default function UpdatePasswordPage() {
  return (
    <div className={`${cardLg} space-y-6 p-6 sm:p-8`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{up.heading}</h1>
        <p className="text-graphite-soft text-base leading-relaxed">{up.subheading}</p>
      </div>
      <UpdatePasswordForm />
    </div>
  )
}
