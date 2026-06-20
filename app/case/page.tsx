import { getCase, getCareHomes, getCaseAnswers } from '@/lib/dal'
import { loadQuestionnaire } from '@/lib/questionnaire-engine'
import { de } from '@/lib/strings/de'
import { CareHomeSelector } from './care-home-selector'
import { PlzForm } from './plz-form'
import { ChatView } from './chat-view'
import { logoutAction } from './actions'

export const metadata = { title: de.case.pageTitle }

const s = de.case

export default async function CasePage() {
  const caseData = await getCase()

  return (
    <main className="bg-muted/40 min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{s.heading}</h1>
              <p className="text-muted-foreground text-sm">{s.subheading}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="border-border text-muted-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
              >
                {s.logoutButton}
              </button>
            </form>
          </div>

          <dl className="divide-border mt-4 divide-y text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Fall-ID</dt>
              <dd className="font-mono text-xs">{caseData.id}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{s.statusLabels[caseData.status] ?? caseData.status}</dd>
            </div>
            {caseData.plz_before_move && (
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">PLZ vor Heimeinzug</dt>
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

        {/* ── Step 1: Care-home selection ─────────────────────── */}
        {!caseData.care_home_id && (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <CareHomeSelectorSection />
          </div>
        )}

        {/* ── Step 2: PLZ entry ────────────────────────────────── */}
        {caseData.care_home_id && caseData.plz_resolution_status === 'unclear' && (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <PlzForm />
          </div>
        )}

        {/* ── Step 3: Questionnaire chat ───────────────────────── */}
        {caseData.questionnaire_id && (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <ChatSection
              caseId={caseData.id}
              questionnaireId={caseData.questionnaire_id}
              caseStatus={caseData.status}
            />
          </div>
        )}
      </div>
    </main>
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
}: {
  caseId: string
  questionnaireId: string
  caseStatus: string
}) {
  const [questionnaire, { answersMap }] = await Promise.all([
    loadQuestionnaire(questionnaireId),
    getCaseAnswers(caseId),
  ])

  return (
    <ChatView
      questionnaire={questionnaire}
      initialAnswersMap={answersMap}
      caseStatus={caseStatus}
    />
  )
}
