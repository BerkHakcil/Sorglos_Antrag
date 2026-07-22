import Image from 'next/image'
import {
  getCase,
  getCareHomes,
  getCaseAnswers,
  getStaticContent,
  getDocumentData,
  type SavedAnswer,
  type StaticContent,
} from '@/lib/dal'
import { loadQuestionnaire } from '@/lib/questionnaire-engine'
import { countMissingSlots, evaluateDocumentRules } from '@/lib/document-rules'
import { DocumentArea } from './document-area'
import { CaseTabs } from './case-tabs'
import type { LoadedQuestionnaire } from '@/lib/questionnaire-types'
import { de } from '@/lib/strings/de'
import { CareHomeSelector } from './care-home-selector'
import { PlzForm } from './plz-form'
import { ChatView } from './chat-view'
import { logoutAction } from './actions'

export const metadata = { title: de.case.pageTitle }

const s = de.case
const sb = de.brand

export default async function CasePage() {
  const caseData = await getCase()
  const content = await getStaticContent()
  const hasQuestionnaire = !!caseData.questionnaire_id

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* ── Brand header — always pinned at top ─────────────── */}
      <header className="border-border bg-card shrink-0 border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Logo lockup (icon + "Sorglos Antrag" wordmark) — replaces the brand
                name text, which the image already contains. Tagline kept alongside. */}
            <Image
              src="/logo.jpg"
              alt={sb.name}
              width={1052}
              height={262}
              priority
              className="h-9 w-auto shrink-0 rounded-md"
            />
            <p className="text-muted-foreground min-w-0 truncate text-[11px] leading-tight">
              {content.brandTagline}
            </p>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="border-border text-muted-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
            >
              {s.logoutButton}
            </button>
          </form>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      {hasQuestionnaire ? (
        /* Questionnaire active: "Fragen | Dokumente" tabs from first login
           (feedback pass item 2). The document checklist is live from the
           start — slots recompute from current answers on every server render
           (D5's completion gate superseded by founder decision). */
        <CaseTabsSection
          caseId={caseData.id}
          questionnaireId={caseData.questionnaire_id!}
          caseStatus={caseData.status}
          plzBeforeMove={caseData.plz_before_move ?? null}
          socialOfficeId={caseData.social_office_id ?? null}
          content={content}
        />
      ) : (
        /* Pre-questionnaire: traditional scrollable card layout */
        <div className="bg-muted/40 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
            {/* Case meta */}
            <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
              <h2 className="mb-3 font-semibold">{content.caseSubheading}</h2>
              <dl className="divide-border divide-y text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{s.statusLabel}</dt>
                  <dd>{s.statusLabels[caseData.status] ?? caseData.status}</dd>
                </div>
                {caseData.plz_before_move && (
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">{s.plzLabel}</dt>
                    <dd>{caseData.plz_before_move}</dd>
                  </div>
                )}
                {/* unsupported-PLZ notice suppressed (CP3/D12): its copy promised a
                    team follow-up, but such users now proceed normally in the Berlin
                    questionnaire. Status stays 'unsupported' internally; new notice
                    copy pending Roman review. */}
              </dl>
            </div>

            {/* Step 1: Care-home selection */}
            {!caseData.care_home_id && (
              <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
                <CareHomeSelectorSection />
              </div>
            )}

            {/* Step 2: PLZ entry */}
            {caseData.care_home_id && caseData.plz_resolution_status === 'unclear' && (
              <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
                <PlzForm />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

async function CareHomeSelectorSection() {
  const careHomes = await getCareHomes()
  return <CareHomeSelector careHomes={careHomes} />
}

/**
 * Questionnaire stage with the "Fragen | Dokumente" tab switcher (item 2).
 * One data fetch feeds both panes: the chat and the LIVE document checklist
 * (own office's rules, else the configured default office's — item 3). No
 * rules from either source → no documents pane, chat renders alone (safety
 * branch, unreachable while a default office is configured).
 */
async function CaseTabsSection({
  caseId,
  questionnaireId,
  caseStatus,
  plzBeforeMove,
  socialOfficeId,
  content,
}: {
  caseId: string
  questionnaireId: string
  caseStatus: string
  plzBeforeMove: string | null
  socialOfficeId: string | null
  content: StaticContent
}) {
  const [{ rules, catalog, uploads }, questionnaire, { answersMap, answersRaw }] =
    await Promise.all([
      getDocumentData(caseId, socialOfficeId),
      loadQuestionnaire(questionnaireId),
      getCaseAnswers(caseId),
    ])
  const { groupInstances, groupAnswers } = deriveGroupData(questionnaire, answersRaw)

  const slots =
    rules.length > 0
      ? evaluateDocumentRules(rules, catalog, {
          answers: answersMap,
          groupInstances,
          groupAnswers,
        })
      : []

  const chat = (
    <ChatView
      questionnaire={questionnaire}
      initialAnswersMap={answersMap}
      initialGroupInstances={groupInstances}
      initialGroupAnswers={groupAnswers}
      caseStatus={caseStatus}
      caseId={caseId}
      plzBeforeMove={plzBeforeMove}
      content={content}
    />
  )
  const documents =
    slots.length > 0 ? <DocumentArea slots={slots} uploads={uploads} content={content} /> : null

  return <CaseTabs chat={chat} documents={documents} missing={countMissingSlots(slots, uploads)} />
}

/**
 * Builds group instance state from the raw answer rows + questionnaire structure.
 *
 * For each repeatable group, collects existing instance IDs (from DB rows with
 * a non-'default' group_instance) and their saved answers.  If a group has no
 * existing instances yet, generates a stable first-instance UUID on the server
 * so the client hydrates without a mismatch.
 */
function deriveGroupData(
  questionnaire: LoadedQuestionnaire,
  answersRaw: SavedAnswer[]
): {
  groupInstances: Record<string, string[]>
  groupAnswers: Record<string, Record<string, unknown>>
} {
  // Map from question ID → { groupKey, questionKey } for repeatable-group questions
  const qToGroup: Record<string, { groupKey: string; questionKey: string }> = {}
  for (const cat of questionnaire.categories) {
    for (const q of cat.questions) {
      if (q.group_key && q.group_is_repeatable) {
        qToGroup[q.id] = { groupKey: q.group_key, questionKey: q.key }
      }
    }
  }

  const groupInstances: Record<string, string[]> = {}
  const groupAnswers: Record<string, Record<string, unknown>> = {}

  for (const a of answersRaw) {
    const info = qToGroup[a.question_id]
    if (!info) continue
    if (a.group_instance === 'default') continue

    const { groupKey, questionKey } = info
    if (!groupInstances[groupKey]) groupInstances[groupKey] = []
    if (!groupInstances[groupKey].includes(a.group_instance)) {
      groupInstances[groupKey].push(a.group_instance)
    }
    if (!groupAnswers[a.group_instance]) groupAnswers[a.group_instance] = {}
    groupAnswers[a.group_instance][questionKey] = a.value
  }

  // Auto-create a first instance for every repeatable group that has none yet.
  // Done server-side so the UUID is stable across SSR and client hydration.
  for (const cat of questionnaire.categories) {
    for (const q of cat.questions) {
      if (q.group_is_repeatable && q.group_key && !groupInstances[q.group_key]) {
        groupInstances[q.group_key] = [crypto.randomUUID()]
      }
    }
  }

  return { groupInstances, groupAnswers }
}
