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
import { docsPaneMode } from '@/lib/docs-pane'
import { deriveGroupData } from '@/lib/group-instances'
import { Phone } from 'lucide-react'
import { DocumentArea } from './document-area'
import { CaseTabs } from './case-tabs'
import { HelpSheet } from './help-sheet'
import { MobileMenu } from './mobile-menu'
import { de } from '@/lib/strings/de'
import { CareHomeSelector } from './care-home-selector'
import { PlzForm } from './plz-form'
import { ChatView } from './chat-view'
import { logoutAction } from './actions'
import { card, focusRing } from '@/components/ui/styles'
import { LegalFooter } from '@/components/legal-footer'
import { caseHeaderTitle } from '@/lib/case-header'

export const metadata = { title: de.case.pageTitle }

const s = de.case
const sb = de.brand

/**
 * R2-1: the sidebar's foot links (Hilfe, Abmelden). The mockup renders them as
 * plain graphite-soft text at base size. min-h-11 keeps the 44px touch floor
 * from the E-7 audit; graphite-soft on the sage sidebar measures 5.94:1
 * (re-measured 2026-08-27 for the R8 brand values).
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
      {/* Petrol on the sage sidebar measures 6.64:1 (re-measured 2026-08-27,
          R8 values) — the mockup's own treatment, and the tagline is an
          existing DB row (brand.tagline), not new German. */}
      <p className="text-primary text-sm leading-tight font-medium">{content.brandTagline}</p>
    </div>
  )

  const sidebarBottom = (
    <div className="flex flex-col gap-5 pt-8">
      <div className="flex items-center gap-5">
        {/* Desktop round 1 / D9 (GATE 1 APPROVED 2026-08-28): this instance —
            the only Hilfe surface at lg+ — opens as a centred bottom sheet.
            The photo is the Roman placeholder asset (real photo still on his
            queue); the phone stays the DB-driven contact.phone row — the
            burger's tel:+491789125300 is deliberately NOT repeated here while
            the two-number question sits with Roman. The burger-menu instance
            below keeps the default panel variant, untouched. */}
        <HelpSheet
          helpButton={content.contactHelpButton}
          cardLabel={content.contactCardLabel}
          name={content.contactName}
          phone={content.contactPhone}
          email={content.contactEmail}
          photoSrc="/roman-placeholder.svg"
          variant="bottomSheet"
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

  /* ── Burger-menu content (mobile round 3 / R2) ───────────────────────────
     Server-rendered here and handed to the client MobileMenu shell, for the
     same reason the sidebar chrome is: the logout form posts to a Server
     Action, and the images/contact rows have no reason to ship as client
     code. Item order is the mockup's, verbatim from the brief: Hilfe, photo
     of Roman, tap-to-call, logo + name, Logout. */
  const mobileMenuItemClass = `text-foreground hover:text-primary inline-flex min-h-11 items-center gap-3 rounded-sm text-base font-medium transition-colors ${focusRing}`
  const mobileMenu = (
    <MobileMenu>
      <nav className="mt-2 flex flex-col gap-4">
        {/* 1 · Hilfe — gate answer 1: reuses the existing HelpSheet contact
            dialog (opens over the menu); no new page, no new German. */}
        <HelpSheet
          helpButton={content.contactHelpButton}
          cardLabel={content.contactCardLabel}
          name={content.contactName}
          phone={content.contactPhone}
          email={content.contactEmail}
          triggerClassName={mobileMenuItemClass}
        />
        {/* 2 · Roman's photo — PLACEHOLDER asset until his real photo arrives
            (ledger). aria-hidden/alt="": the silhouette repeats nothing the
            adjacent name text doesn't already say (HelpSheet-initials
            precedent). */}
        <div className="flex items-center gap-3">
          <Image
            src="/roman-placeholder.svg"
            alt=""
            aria-hidden
            data-testid="menu-roman-photo"
            width={56}
            height={56}
            unoptimized
            className="size-14 shrink-0 rounded-full"
          />
          <p className="text-foreground text-base font-medium">{content.contactName}</p>
        </div>
        {/* 3 · Tap-to-call — the brief's number VERBATIM (tel:+491789125300).
            Gate answer 4: deliberately a DIFFERENT number than the HelpSheet's
            contact.phone row — two numbers on purpose, conflict queued for
            Roman; contact.phone untouched. The visible number doubles as the
            accessible name, so the icon needs no German label. */}
        <a href="tel:+491789125300" data-testid="menu-call-link" className={mobileMenuItemClass}>
          <Phone aria-hidden className="size-5 shrink-0" />
          <span>+49 178 9125300</span>
        </a>
        {/* 4 · Company logo + name — the lockup already contains the wordmark. */}
        <Image
          src="/logo.svg"
          alt={sb.name}
          width={172}
          height={28}
          unoptimized
          className="h-8 w-auto self-start"
        />
        {/* 5 · Logout — the existing Server Action, reused. */}
        <form action={logoutAction}>
          <button type="submit" className={mobileMenuItemClass}>
            {s.logoutButton}
          </button>
        </form>
      </nav>
    </MobileMenu>
  )

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* E-7: the case screen had no h1 at all — it began at h2, so screen-reader
          users got a document with no title and a skipped level. The visible
          brand mark is an image, and the visible headings below are section
          headings, so the page title is exposed here for assistive tech only.
          Reuses the already-authored de.case.pageTitle: no new German. */}
      <h1 className="sr-only">{s.pageTitle}</h1>
      {/* ── Mobile top bar (round 3 / R1+R2): the old logo/tagline/Hilfe/
          Abmelden header is GONE below lg — CaseTabs renders burger + the
          applicant-name title instead, and every old member has a home in
          the burger menu (logo, Hilfe, Abmelden) except the tagline, which
          is dropped below lg by gate answer 5. Desktop (lg+) is untouched:
          the sidebar carries logo/tagline/Hilfe/Abmelden as before, and the
          Hilfe sheet stays reachable from every state incl. the pre-steps
          (D11) — now via the burger. */}

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
          mobileMenu={mobileMenu}
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
          mobileMenu={mobileMenu}
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
                {/* Desktop round 1 / D6 (GATE 1 APPROVED 2026-08-28): the case-meta
                    card (subheading + Status row + PLZ row) is GONE on every
                    viewport — case id, PLZ and case status no longer appear
                    anywhere in the applicant-facing UI. The subheading already
                    renders as the pinned header title in this state, so the card
                    had become a duplicate heading plus two meta rows the founder
                    removed. (The suppressed unsupported-PLZ notice that lived
                    here is still an open Roman item; its copy is in de.ts.) */}

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
  mobileMenu,
}: {
  caseId: string
  questionnaireId: string
  caseStatus: string
  socialOfficeId: string | null
  content: StaticContent
  sidebarTop: ReactNode
  sidebarBottom: ReactNode
  mobileMenu: ReactNode
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
    /* Round 3: headerTitle/headerIntro are no longer passed — the shell's
       pinned mobile chrome carries them now (R1/R3), so ChatView renders no
       in-scroller copy. */
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
        // Fallback lists drop the per-office period suffix (a claim the
        // default list cannot make). The fallback-notice banner that used to
        // ride this signal was removed 2026-08-26 (fallback-docs fix, Gate 1)
        // — the fallback list is now the purged generic default and carries
        // no caveat; the suffix suppression deliberately stays (§8 Q5).
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
      mobileMenu={mobileMenu}
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
