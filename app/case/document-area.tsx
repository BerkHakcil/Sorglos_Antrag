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
import { countMissingSlots, type DocumentSlot } from '@/lib/document-rules'
import type { UploadRow, StaticContent } from '@/lib/dal'
import { Check, FileText } from 'lucide-react'
import {
  createUploadUrlAction,
  recordUploadAction,
  deleteUploadAction,
  createDownloadUrlAction,
} from './document-actions'
import { btnOutline, card, focusRing, linkPetrol } from '@/components/ui/styles'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']

/**
 * Browsers (notably desktop Chromium) report an EMPTY file.type for HEIC/HEIF —
 * fall back to the extension so those uploads aren't wrongly rejected. The
 * server re-validates mime + extension, and the bucket enforces allowed types.
 */
function effectiveMime(file: File): string {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return (
    {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      heif: 'image/heif',
    }[ext ?? ''] ?? ''
  )
}

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
    | 'docsMissingCount'
    | 'docsMissingCountOne'
    | 'docsAllUploaded'
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
    const mime = effectiveMime(file)
    setErrors((e) => ({ ...e, [key]: '' }))
    if (!ALLOWED_MIME.includes(mime)) {
      setErrors((e) => ({ ...e, [key]: content.docsErrorType }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, [key]: content.docsErrorSize }))
      return
    }
    setBusySlot(key)
    try {
      // Slot identity goes to the server so it can build the readable key
      // ({case}/{Folder}/{Base}{n}.{ext}); the document's German name and
      // category are read from the catalog server-side, never sent from here.
      const minted = await createUploadUrlAction({
        filename: file.name,
        mimeType: mime,
        sizeBytes: file.size,
        documentId: slot.documentId,
        subject: slot.subject,
        instanceLabel: slot.instanceLabel,
      })
      if (!minted.ok) {
        setErrors((e) => ({ ...e, [key]: minted.error }))
        return
      }
      const supabase = createClient()
      // A typeless File (HEIC on desktop) must be re-wrapped so the PUT carries
      // the derived MIME — the bucket rejects application/octet-stream.
      const body = file.type ? file : new File([file], file.name, { type: mime })
      const { error: putErr } = await supabase.storage
        .from('case-documents')
        .uploadToSignedUrl(minted.path, minted.token, body, { contentType: mime })
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

  // M6 counter — derives from the server-provided slots + uploads; upload and
  // delete both router.refresh(), so it updates without a full page reload.
  const missing = countMissingSlots(slots, uploads)
  const counterText =
    missing === 0
      ? content.docsAllUploaded
      : missing === 1
        ? content.docsMissingCountOne
        : content.docsMissingCount.replace('{n}', String(missing))

  return (
    <section data-testid="document-area" className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{content.docsAreaTitle}</h2>
        {/* E-4: the "done" state uses the palette's petrol, not an off-palette
            green-700. Missing stays neutral by the semantic colour rule —
            an un-uploaded document is an unreached step, not a warning, so it
            gets no amber and no red. */}
        <p
          data-testid="missing-docs-counter"
          data-missing={missing}
          className={missing === 0 ? 'text-primary text-sm font-medium' : 'text-sm font-medium'}
        >
          {counterText}
        </p>
        <p className="text-graphite-soft mt-1 text-sm leading-relaxed">{content.docsAreaIntro}</p>
      </div>
      {groups.map(({ heading, subject }) => {
        const list = slots.filter((s) => s.subject === subject)
        if (list.length === 0) return null
        return (
          <div key={subject} className="space-y-2">
            <h3 className="text-graphite-soft text-xs font-semibold tracking-wide uppercase">
              {heading}
            </h3>
            {/* E-4: the mockup groups rows into ONE card separated by hairlines,
                rather than a stack of separate bordered boxes. doc-slot stays on
                each row so documents-m6 still counts and reads slots exactly as
                before. */}
            <div className={`${card} divide-border divide-y overflow-hidden`}>
              {list.map((slot) => {
                const key = slotKey(slot)
                const files = filesFor(slot)
                const done = files.length > 0
                return (
                  <div
                    key={key}
                    data-testid="doc-slot"
                    className={`p-4 transition-colors ${done ? 'bg-sage-soft/30' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Status medallion. aria-hidden: the adjacent
                            slot-status text already states the state, so the
                            icon would only repeat it to a screen reader. */}
                        <span
                          aria-hidden
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                            done ? 'bg-primary text-white' : 'bg-cream-deep text-graphite-soft'
                          }`}
                        >
                          {done ? <Check className="size-4" /> : <FileText className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {slot.nameDe}
                            {slot.instanceLabel ? ` – ${slot.instanceLabel}` : ''}
                          </p>
                          <p
                            className={`text-xs ${done ? 'text-primary' : 'text-graphite-soft'}`}
                            data-testid="slot-status"
                          >
                            {files.length === 0
                              ? content.docsStatusMissing
                              : content.docsStatusUploaded.replace('{n}', String(files.length))}
                          </p>
                        </div>
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
                          className={`${btnOutline} px-3 py-1.5 text-xs`}
                        >
                          {content.docsUploadButton}
                        </button>
                      </div>
                    </div>
                    {errors[key] && (
                      <p role="alert" className="text-destructive mt-2 text-xs">
                        {errors[key]}
                      </p>
                    )}
                    {files.length > 0 && (
                      /* Uploaded files sit indented under the medallion so the
                         row reads as one unit. */
                      <ul className="mt-3 space-y-1 pl-12">
                        {files.map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <button
                              type="button"
                              className={`${linkPetrol} min-w-0 truncate`}
                              onClick={async () => {
                                const r = await createDownloadUrlAction(u.id)
                                if (r.ok) window.open(r.url, '_blank', 'noopener')
                              }}
                            >
                              {u.original_filename}
                            </button>
                            <button
                              type="button"
                              className={`text-graphite-soft hover:text-destructive shrink-0 rounded-sm ${focusRing}`}
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
          </div>
        )
      })}
    </section>
  )
}
