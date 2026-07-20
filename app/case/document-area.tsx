'use client'

/**
 * M5 document area — checklist of evaluated slots with per-slot uploads.
 * Renders only when the server decided the case qualifies (completed + the
 * resolved office has rules). All German comes from static_content.
 * Upload flow: client pre-checks (friendly errors) → server mints a signed
 * upload URL → browser PUTs direct to storage → server records metadata.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DocumentSlot } from '@/lib/document-rules'
import type { UploadRow, StaticContent } from '@/lib/dal'
import {
  createUploadUrlAction,
  recordUploadAction,
  deleteUploadAction,
  createDownloadUrlAction,
} from './document-actions'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']

type Props = {
  slots: DocumentSlot[]
  uploads: UploadRow[]
  content: Pick<
    StaticContent,
    | 'docsAreaTitle'
    | 'docsAreaIntro'
    | 'docsStatusMissing'
    | 'docsStatusUploaded'
    | 'docsUploadButton'
    | 'docsDeleteButton'
    | 'docsErrorType'
    | 'docsErrorSize'
    | 'docsErrorGeneric'
    | 'docsHeadingPerson1'
    | 'docsHeadingPerson2'
    | 'docsHeadingPreviousHome'
  >
}

export function DocumentArea({ slots, uploads, content }: Props) {
  const router = useRouter()
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const slotKey = (s: DocumentSlot) => `${s.ruleId}:${s.instanceKey}`
  const filesFor = (s: DocumentSlot) =>
    uploads.filter((u) => u.rule_id === s.ruleId && u.instance_key === s.instanceKey)

  async function handleFile(slot: DocumentSlot, file: File) {
    const key = slotKey(slot)
    setErrors((e) => ({ ...e, [key]: '' }))
    if (!ALLOWED_MIME.includes(file.type)) {
      setErrors((e) => ({ ...e, [key]: content.docsErrorType }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, [key]: content.docsErrorSize }))
      return
    }
    setBusySlot(key)
    try {
      const minted = await createUploadUrlAction({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if (!minted.ok) {
        setErrors((e) => ({ ...e, [key]: minted.error }))
        return
      }
      const supabase = createClient()
      const { error: putErr } = await supabase.storage
        .from('case-documents')
        .uploadToSignedUrl(minted.path, minted.token, file, { contentType: file.type })
      if (putErr) {
        setErrors((e) => ({ ...e, [key]: content.docsErrorGeneric }))
        return
      }
      const rec = await recordUploadAction({
        path: minted.path,
        ruleId: slot.ruleId,
        documentId: slot.documentId,
        subject: slot.subject,
        instanceKey: slot.instanceKey,
        originalFilename: file.name,
      })
      if (!rec.ok) {
        setErrors((e) => ({ ...e, [key]: rec.error }))
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusySlot(null)
    }
  }

  const groups: { heading: string; subject: DocumentSlot['subject'] }[] = [
    { heading: content.docsHeadingPerson1, subject: 'person_1' },
    { heading: content.docsHeadingPerson2, subject: 'person_2' },
    { heading: content.docsHeadingPreviousHome, subject: 'previous_home' },
  ]

  return (
    <section data-testid="document-area" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{content.docsAreaTitle}</h2>
        <p className="text-muted-foreground text-sm">{content.docsAreaIntro}</p>
      </div>
      {groups.map(({ heading, subject }) => {
        const list = slots.filter((s) => s.subject === subject)
        if (list.length === 0) return null
        return (
          <div key={subject} className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              {heading}
            </h3>
            {list.map((slot) => {
              const key = slotKey(slot)
              const files = filesFor(slot)
              return (
                <div
                  key={key}
                  data-testid="doc-slot"
                  className="border-border bg-card rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {slot.nameDe}
                        {slot.instanceLabel ? ` – ${slot.instanceLabel}` : ''}
                      </p>
                      <p className="text-muted-foreground text-xs" data-testid="slot-status">
                        {files.length === 0
                          ? content.docsStatusMissing
                          : content.docsStatusUploaded.replace('{n}', String(files.length))}
                      </p>
                    </div>
                    <div>
                      <input
                        ref={(el) => {
                          inputs.current[key] = el
                        }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void handleFile(slot, f)
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        disabled={busySlot === key}
                        onClick={() => inputs.current[key]?.click()}
                        className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                      >
                        {content.docsUploadButton}
                      </button>
                    </div>
                  </div>
                  {errors[key] && (
                    <p role="alert" className="text-destructive mt-1 text-xs">
                      {errors[key]}
                    </p>
                  )}
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {files.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            className="text-primary min-w-0 truncate underline-offset-2 hover:underline"
                            onClick={async () => {
                              const r = await createDownloadUrlAction(u.id)
                              if (r.ok) window.open(r.url, '_blank', 'noopener')
                            }}
                          >
                            {u.original_filename}
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={async () => {
                              await deleteUploadAction(u.id)
                              startTransition(() => router.refresh())
                            }}
                          >
                            {content.docsDeleteButton}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}
