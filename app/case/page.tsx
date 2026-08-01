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
import { docsPaneMode } from '@/lib/docs-pane'
import { DocumentArea } from './document-area'
import { CaseTabs } from './case-tabs'
import { HelpSheet } from './help-sheet'
import type { LoadedQuestionnaire } from '@/lib/questionnaire-types'
import { de } from '@/lib/strings/de'
import { CareHomeSelector } from './care-home-selector'
import { PlzForm } from './plz-form'
import { ChatView } from './chat-view'
import { logoutAction } from './actions'
import { btnGhost, card } from '@/components/ui/styles'

export const metadata = { title: de.case.pageTitle }

const s = de.case
const sb = de.brand

export default async function CasePage() {
  const caseData = await getCase()
  const content = await getStaticContent()
  const hasQuestionnaire = !!caseData.questionnaire_id

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* E-7: the case screen had no h1 at all — it began at h2, so screen-reader
          users got a document with no title and a skipped level. The visible
          brand mark is an image, and the visible headings below are section
          headings, so the page title is exposed here for assistive tech only.
          Reuses the already-authored de.case.pageTitle: no new German. */}
      <h1 className="sr-only">{s.pageTitle}</h1>
      {/* ── Brand header — always pinned at top ─────────────── */}
      {/* E-2: the mockup's AppHeader sits on the page background with a soft
          rule, not on a white slab — the white card surface is reserved for
          content. */}
      <header className="border-border/60 bg-background/95 shrink-0 border-b backdrop-blur">
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
            <p className="text-graphite-soft min-w-0 truncate text-[11px] leading-tight">
              {content.brandTagline}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Pass 4 / D11: contact sheet, reachable from every state incl.
                the pre-steps. Renders nothing while its content rows are
                missing (static_content degrades to ''). */}
            <HelpSheet
              helpButton={content.contactHelpButton}
              cardLabel={content.contactCardLabel}
              name={content.contactName}
              phone={content.contactPhone}
              email={content.contactEmail}
            />
            <form action={logoutAction}>
              <button type="submit" className={`${btnGhost} px-3 py-1.5 text-xs`}>
                {s.logoutButton}
              </button>
            </form>
          </div>
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
        /* Pre-questionnaire (D3, pass 4): the "Fragen | Dokumente" tabs exist
           from FIRST LOGIN. The checklist cannot be computed before the PLZ
           decides the office, so the Dokumente pane shows Roman's placeholder
           instead of a list; no badge renders (CaseTabs hides it at 0). */
        <CaseTabs
          missing={0}
          documents={
            docsPaneMode(false, 0) === 'placeholder' ? (
              <DocsPlaceholder
                title={content.docsAreaTitle}
                body={content.docsPlaceholderNeedsPlz}
              />
            ) : null
          }
          chat={
            <div className="bg-muted/40 h-full overflow-y-auto">
              <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
                {/* Case meta */}
                <div className={`${card} p-6`}>
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
                  <div className={`${card} p-6`}>
                    <CareHomeSelectorSection />
                  </div>
                )}

                {/* Step 2: PLZ entry */}
                {caseData.care_home_id && caseData.plz_resolution_status === 'unclear' && (
                  <div className={`${card} p-6`}>
                    <PlzForm />
                  </div>
                )}
              </div>
            </div>
          }
        />
      )}
    </div>
  )
}

async function CareHomeSelectorSection() {
  const careHomes = await getCareHomes()
  return <CareHomeSelector careHomes={careHomes} />
}

/**
 * D3 (pass 4): the Dokumente pane before the PLZ resolves an office. Title
 * reuses the pane's existing DB-authored heading; the body is Roman's
 * placeholder sentence, verbatim (static_content 'docs.placeholder_needs_plz').
 */
function DocsPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <section data-testid="docs-placeholder" className={`${card} p-6`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-graphite-soft mt-2 text-sm leading-relaxed">{body}</p>
    </section>
  )
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
  // 'list' renders the checklist; 'none' (zero rules anywhere — safety branch)
  // keeps the chat alone. 'placeholder' is unreachable here: this section only
  // renders once the questionnaire exists (see docsPaneMode docs).
  const paneMode = docsPaneMode(true, slots.length)

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
    paneMode === 'list' ? <DocumentArea slots={slots} uploads={uploads} content={content} /> : null

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
