import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  getCase,
  getCareHomes,
  getCaseAnswers,
  getStaticContent,
  getDocumentData,
  type StaticContent,
} from '@/lib/dal'
import { loadQuestionnaire } from '@/lib/questionnaire-engine'
import { countMissingSlots, evaluateDocumentRules } from '@/lib/document-rules'
import { docsPaneMode, fallbackNoticeText } from '@/lib/docs-pane'
import { deriveGroupData } from '@/lib/group-instances'
import { DocumentArea } from './document-area'
import { CaseTabs } from './case-tabs'
import { HelpSheet } from './help-sheet'
import { de } from '@/lib/strings/de'
import { CareHomeSelector } from './care-home-selector'
import { PlzForm } from './plz-form'
import { ChatView } from './chat-view'
import { logoutAction } from './actions'
import { btnGhost, card, focusRing } from '@/components/ui/styles'
import { LegalFooter } from '@/components/legal-footer'
import { caseHeaderTitle } from '@/lib/case-header'

export const metadata = { title: de.case.pageTitle }

const s = de.case
const sb = de.brand

/**
 * R2-1: the sidebar's foot links (Hilfe, Abmelden). The mockup renders them as
 * plain graphite-soft text at base size — bigger and chrome-less compared with
 * the top bar's ghost buttons. min-h-11 keeps the 44px touch floor from the
 * E-7 audit; graphite-soft on the sage sidebar measures 5.09:1.
 */
const sidebarLinkClass = `text-graphite-soft hover:text-foreground inline-flex min-h-11 items-center rounded-sm text-base font-medium transition-colors ${focusRing}`

export default async function CasePage() {
  const caseData = await getCase()
  const content = await getStaticContent()
  const hasQuestionnaire = !!caseData.questionnaire_id

  /* ── Sidebar chrome (R2-1) ───────────────────────────────────────────────
     Rendered here, on the server, and passed into CaseTabs: the logout form
     posts to a Server Action, and the brand mark/legal links have no reason to
     ship to the client. CaseTabs owns only the placement and the nav. */
  const sidebarTop = (
    <div className="flex flex-col gap-1.5">
      <Image
        src="/logo.svg"
        alt={sb.name}
        data-testid="brand-logo"
        width={172}
        height={28}
        priority
        unoptimized
        className="h-8 w-auto"
      />
      {/* Petrol on the sage sidebar measures 5.5:1 — the mockup's own
          treatment, and the tagline is an existing DB row (brand.tagline),
          not new German. */}
      <p className="text-primary text-sm leading-tight font-medium">{content.brandTagline}</p>
    </div>
  )

  const sidebarBottom = (
    <div className="flex flex-col gap-5 pt-8">
      <div className="flex items-center gap-5">
        <HelpSheet
          helpButton={content.contactHelpButton}
          cardLabel={content.contactCardLabel}
          name={content.contactName}
          phone={content.contactPhone}
          email={content.contactEmail}
          triggerClassName={sidebarLinkClass}
        />
        <form action={logoutAction}>
          <button type="submit" className={sidebarLinkClass}>
            {s.logoutButton}
          </button>
        </form>
      </div>
      {/* D6 extrapolation: the mockup specifies no legal links, so on desktop
          they join the sidebar foot rather than keeping a full-width bar that
          would cut across the new layout. */}
      <LegalFooter variant="sidebar" />
    </div>
  )

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* E-7: the case screen had no h1 at all — it began at h2, so screen-reader
          users got a document with no title and a skipped level. The visible
          brand mark is an image, and the visible headings below are section
          headings, so the page title is exposed here for assistive tech only.
          Reuses the already-authored de.case.pageTitle: no new German. */}
      <h1 className="sr-only">{s.pageTitle}</h1>
      {/* ── Brand header — pinned at top BELOW lg only ───────
          E-2: the mockup's AppHeader sits on the page background with a soft
          rule, not on a white slab — the white card surface is reserved for
          content.
          R2-1: from lg every member of this bar has a home in the sidebar
          (logo + tagline at its head, Hilfe/Abmelden at its foot), so the bar
          itself is hidden rather than duplicated. */}
      <header className="border-border/60 bg-background/95 shrink-0 border-b backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Logo lockup (icon + "Sorglos Antrag" wordmark) — replaces the brand
                name text, which the image already contains. Tagline kept alongside.
                Roman's SVG (mini round 2026-08-13); unoptimized: the Next image
                optimizer refuses SVG, the file is served as-is. */}
            <Image
              src="/logo.svg"
              alt={sb.name}
              data-testid="brand-logo"
              width={172}
              height={28}
              priority
              unoptimized
              className="h-9 w-auto shrink-0"
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
        /* Questionnaire active: "Angaben | Unterlagen" tabs from first login
           (feedback pass item 2). The document checklist is live from the
           start — slots recompute from current answers on every server render
           (D5's completion gate superseded by founder decision). */
        <CaseTabsSection
          caseId={caseData.id}
          questionnaireId={caseData.questionnaire_id!}
          caseStatus={caseData.status}
          socialOfficeId={caseData.social_office_id ?? null}
          content={content}
          sidebarTop={sidebarTop}
          sidebarBottom={sidebarBottom}
        />
      ) : (
        /* Pre-questionnaire (D3, pass 4): the "Angaben | Unterlagen" tabs exist
           from FIRST LOGIN. The checklist cannot be computed before the PLZ
           decides the office, so the Unterlagen pane shows Roman's placeholder
           instead of a list; no badge renders (CaseTabs hides it at 0). */
        <CaseTabs
          missing={0}
          sidebarTop={sidebarTop}
          sidebarBottom={sidebarBottom}
          /* Pre-steps: no answers exist yet, so the header shows the standing
             fallback. The patient intro is deliberately absent here — the
             questions it describes have not started. */
          headerTitle={content.caseSubheading}
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
      {/* Mini round 2026-08-13: legal footer INSIDE the h-dvh column as a
          shrink-0 row — the chat area (with its own answer footer) ends above
          it, so the two can never overlap on any viewport.
          R2-1: below lg only. From lg the sidebar foot carries the links, and
          two visible copies would be a duplicate landmark. */}
      <div className="shrink-0 lg:hidden">
        <LegalFooter />
      </div>
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
  socialOfficeId,
  content,
  sidebarTop,
  sidebarBottom,
}: {
  caseId: string
  questionnaireId: string
  caseStatus: string
  socialOfficeId: string | null
  content: StaticContent
  sidebarTop: ReactNode
  sidebarBottom: ReactNode
}) {
  const [{ rules, rulesSource, catalog, uploads }, questionnaire, { answersMap, answersRaw }] =
    await Promise.all([
      getDocumentData(caseId, socialOfficeId),
      loadQuestionnaire(questionnaireId),
      getCaseAnswers(caseId),
    ])
  const { groupInstances, groupAnswers } = deriveGroupData(questionnaire, answersRaw, 'render')

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

  // Item 3 (go-live round 2): the locked card is docs-aware — the same
  // missing count the tab badge shows also drives the card variant. Freshness
  // is free: upload/delete already router.refresh(), re-running this server
  // component and re-feeding both consumers.
  const missingDocs = countMissingSlots(slots, uploads)

  const headerTitle = caseHeaderTitle(
    answersMap,
    content.headerTitlePattern,
    content.caseSubheading
  )

  const chat = (
    <ChatView
      questionnaire={questionnaire}
      initialAnswersMap={answersMap}
      initialGroupInstances={groupInstances}
      initialGroupAnswers={groupAnswers}
      caseStatus={caseStatus}
      content={content}
      missingDocs={missingDocs}
    />
  )
  const documents =
    paneMode === 'list' ? (
      <DocumentArea
        slots={slots}
        uploads={uploads}
        content={content}
        // Go-live honesty banner: non-null exactly when this checklist is the
        // default office's generic list, not the case's own office's rules.
        fallbackNotice={fallbackNoticeText(rulesSource, paneMode, content.docsFallbackNotice)}
        // Same signal, no text dependency: fallback lists also drop the
        // per-office period suffix (a claim the default list cannot make).
        fromFallbackRules={rulesSource === 'fallback'}
      />
    ) : null

  return (
    <CaseTabs
      chat={chat}
      documents={documents}
      missing={missingDocs}
      sidebarTop={sidebarTop}
      sidebarBottom={sidebarBottom}
      headerTitle={headerTitle}
      /* F2: the Angaben intro is Roman's EXISTING patient-banner body, reused
         verbatim rather than adopting the mockup's near-identical sentence —
         his grammar wins and no row is added. It used to render as a separate
         sage banner below; saying it once, here, is the whole point. */
      introQuestions={content.patientBannerBody}
      introDocuments={content.headerIntroDocuments}
    />
  )
}

// deriveGroupData moved to lib/group-instances.ts (pass 4 / D15): count-driven
// groups made ONE shared derivation mandatory — this site uses mode 'render'
// (auto-create a first instance for classic groups so the UUID is stable
// across SSR and client hydration; count-driven groups render exactly N).
