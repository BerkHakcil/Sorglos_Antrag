import { getCase, getCareHomes, getCaseAnswers, type SavedAnswer } from '@/lib/dal'
import { loadQuestionnaire } from '@/lib/questionnaire-engine'
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
  const hasQuestionnaire = !!caseData.questionnaire_id

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── Brand header — always pinned at top ─────────────── */}
      <header className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo placeholder — replace with <Image> when asset is ready */}
            <div
              className="size-8 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center select-none"
              aria-hidden="true"
            >
              <span className="text-[9px] leading-none text-muted-foreground">Logo</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">{sb.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {sb.tagline}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="border border-border text-muted-foreground hover:bg-muted rounded-md px-3 py-1.5 text-xs"
            >
              {s.logoutButton}
            </button>
          </form>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      {hasQuestionnaire ? (
        /* Questionnaire active: full-height chat layout handled inside ChatView */
        <div className="flex-1 overflow-hidden">
          <ChatSection
            caseId={caseData.id}
            questionnaireId={caseData.questionnaire_id!}
            caseStatus={caseData.status}
            plzBeforeMove={caseData.plz_before_move ?? null}
          />
        </div>
      ) : (
        /* Pre-questionnaire: traditional scrollable card layout */
        <div className="flex-1 overflow-y-auto bg-muted/40">
          <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
            {/* Case meta */}
            <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
              <h2 className="font-semibold mb-3">{s.subheading}</h2>
              <dl className="divide-border divide-y text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{s.caseIdLabel}</dt>
                  <dd className="font-mono text-xs">{caseData.id}</dd>
                </div>
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
                {caseData.plz_resolution_status === 'unsupported' && (
                  <div className="py-2">
                    <p className="text-amber-700 dark:text-amber-400 text-xs">
                      {s.plz.unsupportedNotice}
                    </p>
                  </div>
                )}
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

async function ChatSection({
  caseId,
  questionnaireId,
  caseStatus,
  plzBeforeMove,
}: {
  caseId: string
  questionnaireId: string
  caseStatus: string
  plzBeforeMove: string | null
}) {
  const [questionnaire, { answersMap, answersRaw }] = await Promise.all([
    loadQuestionnaire(questionnaireId),
    getCaseAnswers(caseId),
  ])

  const { groupInstances, groupAnswers } = deriveGroupData(questionnaire, answersRaw)

  return (
    <ChatView
      questionnaire={questionnaire}
      initialAnswersMap={answersMap}
      initialGroupInstances={groupInstances}
      initialGroupAnswers={groupAnswers}
      caseStatus={caseStatus}
      caseId={caseId}
      plzBeforeMove={plzBeforeMove}
    />
  )
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
  answersRaw: SavedAnswer[],
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
