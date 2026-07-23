# Known limitations (M7, go-live gate)

> Honest one-pager for the founders and, if needed, pilot stakeholders.
> Current as of 2026-07-21 (M1–M6 complete + M7 stabilisation). Items marked
> _by design_ are decisions of record, not oversights — sources in
> `docs/milestone-log.md`.

## Product scope (by design, post-go-live roadmap)

- **No admin interface.** Operations run via Supabase Studio (read-only
  browsing) + the service-role scripts in `docs/operations.md`
  (`npm run case:export` is the bridge to manual PDF filling).
- **No PDF generation / download / signed-application upload.** Roman fills
  the official forms by hand from the case export.
- **No care-home dashboard, no transmission to authorities, no analytics.**
- **One case per user**, no multi-case support.

## Behavior quirks (documented, not fixed for go-live)

- **No answer editing after completion.** Once all required questions are
  answered the case locks (`under_review`, M3). The document checklist stays
  _live_ (M6: requirements recompute from answers on every load), but the
  answers themselves cannot change in-product. Product question pending with
  Roman: post-completion editing would reopen the M3 edit lock and needs its
  own scoping.
- **"Keine Rente" loop prompt** (both questionnaires): selecting "Keine Rente"
  still shows "Möchten Sie weitere Renten hinzufügen?" — one redundant click.
- **Repeatable group as final question** (Essen, married path, when only
  "sonstiges Vermögen" is selected in the spouse wealth bulk): answering the
  last group member completes the case before the "add another?" prompt can be
  offered — a second instance can't be added. Rare path; parked with options.
- **Unmapped postal codes silently get the Berlin questionnaire** (CP3/D12,
  by design). The internal `plz_resolution_status='unsupported'` signal is
  written; no user-facing notice (its replacement copy is pending Roman).
- **Every case gets the DEFAULT (Pankow) document checklist** until an
  office-specific rule set exists (feedback-pass founder decision, supersedes
  D5's Pankow-only scoping; default configured in `app_config`, flipped to
  Essen by one migration when Roman's seed lands). Consequences, accepted:
  **over-collection** — Pankow-specific mandatory documents (Mobilitätsnachweis,
  Nachweis Bedarfsanzeige, polizeiliche Anmeldung im Heim) are requested from
  all users; **under-collection for Essen-questionnaire cases** — conditional
  rules keyed on Berlin-only questions (Haftpflicht, Wohngeld, KFZ, Miete,
  Spätaussiedler, Sozialhilfe, citizenship, spouse-in-facility) silently never
  fire there, and PAN-022 (Sterbeversicherung) stays Berlin-triggered only
  (its Essen mapping was excluded — the candidate key exists in Berlin too).
- **Optional questions**: pressing "Weiter" with no input re-asks; only the
  skip button moves on. Affects `birth_name` only today.

## Documents & files

- **HEIC uploads are stored as-is, no preview anywhere** (D7). Reviewers
  download to view (the case export does this); Windows may need the HEIF
  extension.
- **Orphaned storage objects are tolerated** (tab closed mid-upload; user
  deletion — storage does not cascade). Invisible to users; cleaned up via the
  GDPR/deletion runbook. No cleanup machinery by design.

## Infrastructure & operations

- **No error-monitoring service.** Vercel function logs + Supabase auth logs
  are the only sinks; `npm run smoke:signup` is the auth-email first responder.
- **Pilot runs on `https://sorglos-antrag.vercel.app`** while auth emails send
  from `@sorglosantrag.de` — the app-domain/email-domain mismatch is accepted
  for the pilot and resolved by the deferred domain cutover
  (`docs/operations.md` §6) before scale.
- **CI e2e job is dormant** (repo variables never set); e2e verification runs
  ad hoc against prod per milestone.
- **Pending-German ledger FINALIZED by founder decision (2026-07-23):** all
  constructed strings that had been live for weeks through three Roman review
  passes with zero flags are final (docs-area/counter/tab copy, the auth email
  template + subjects, spouse member_since/Ausland prompts). **Remaining open
  Roman items — exactly three:** the Essen document rules file (governs the
  live default checklist), and the spouse-section review carrying only the
  bulk-intro alignment + the insurance-depth question (both cosmetic,
  non-gating).
- **PLZ routing follows the include-when-in-doubt policy**
  (`docs/operations.md` §7): office lists may deliberately contain
  administratively adjacent PLZs; overlaps get resolved when the overlapping
  office is implemented; a missed PLZ degrades to the default questionnaire +
  default document list.
