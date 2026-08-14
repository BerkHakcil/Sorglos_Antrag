# Go-live round 2 — session state

> Resume protocol: read this file first, then the Phase-1 report
> (`golive_round2.md`). Batch GOs were given 2026-08-13 (all three premise
> corrections accepted). Roman package: `roman_package_round2.md`.

## ⚠ SEQUENCING RULE (founder, 2026-08-13)

Migration `20260813000003` (item 6) MUST be pushed **before** any ops-side
correction of case `52e364f1`'s expiry dates (the item-5 follow-up asks the
customer to re-confirm "2027-08-11"). Its named drift assert pins that exact
value — if ops corrects first, the assert aborts and must be updated before
pushing. The rule is also in the migration header, and the Roman package asks
him to ping us before correcting.

## Phase status

| Phase                        | Status                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 read-only triage     | ✅ DONE 2026-08-13, verdicts accepted                | `golive_round2.md` (incl. verify-pass corrections). Premise corrections: PAN-025 exists+works; all 3 prod cases fallback-served; Essen gap may be intentional                                                                                                                                                                                                                                                                    |
| Batch A+B implementation     | ✅ DONE 2026-08-13 (branch `golive-round2`)          | 3 migrations + code + tests; adversarial diff review fixed 7 real findings pre-commit (incl. the 77/77 composition, C7 storage-orphan cleanup)                                                                                                                                                                                                                                                                                   |
| Founder migration push       | ✅ DONE 2026-08-13                                   | One `supabase db push`, every NOTICE fired as designed; post-push data-level check **20/20** incl. rico recompute **77/77** with the expiry visible                                                                                                                                                                                                                                                                              |
| Preview gate                 | ✅ DONE 2026-08-13 — cumulative green                | 18 passed / 13 known-skipped / 2 failed in 3.3 min; both failures = documented machine-stall class, re-ran green alone vs the SAME deployment (1.3 / 3.6 min)                                                                                                                                                                                                                                                                    |
| Merge + live verification    | ✅ DONE 2026-08-13 — **ROUND CLOSED**                | ff-merge `4f21de8 → 9920888`, prod deployed. Live: disability-gate G1–G4 + date-bounds PASS (53 s); scripted Betreuer check ALL PASS (empty Weiter refused); completion C1–C7 PASS (1.7 min: docs-variant + tab switch + 0-missing byte-identical). Leak sweep clean; fixture storage purged to 0; zero debris. Full record: milestone-log round-2 entry                                                                         |
| Batch C (PLZ reconciliation) | ✅ **CLOSED 2026-08-13** — both pushes live-verified | Push 1: all 5 NOTICEs, data checks ALL PASS, live drives ALL PASS. Push 2: backfills rico→MH / berk→FK / fixture→Mitte each with its `status_event` audit row, city office inactive, zero references, rico uploads intact (19). Deferred completion leg: fixture re-seeded (new case resolved 10115→Mitte via the NEW rules, proving the remap end-to-end) and completion.spec PASSED vs prod (1.5 min). Milestone entry written |
| Roman round-trip             | ✅ **CLOSED 2026-08-13** — all answers received      | Item 1 → ESS-056 shipped (`20260813000007`); item 2 → applied as proposed (`20260813000006`); all texts approved via the founder's blanket waiver ("approved by Erman 2026-08-13, Roman review waived"); Klaus dates: leave as is, ask withdrawn; photo: later, non-blocking. Dispositions in the ledger + package header                                                                                                        |

## Founder push list — waiver round (2026-08-13, one `supabase db push`, CURRENT)

1. `20260813000006_item2_behoerde_clarification.sql` — the two Behörde
   prompts → Vertriebenen-/Spätaussiedlerausweis wording (applicant +
   spouse). Expect NOTICE: both prompts applied. Aborts if the old prompt
   is not on exactly the two surveyed rows.
2. `20260813000007_ess056_essen_death_certificate.sql` — Essen Sterbeurkunde
   rule for widowed applicants. Expect NOTICEs: guards passed (DOC-0016
   active, 55 rules, id free, widowed value verified char-for-char) →
   ESS-056 applied (56 rules).

## Founder push list — Batch C push 1 (2026-08-13, DONE, historical)

`20260813000004_batch_c_berlin_district_remap.sql` — Parts A/B. Expected
NOTICEs, in order: Part A applied (11 district offices, official names) →
Part B pre-asserts passed (190 city prio-1 single-PLZ, 21 Pankow prio-20) →
B1 applied (21 shadowed duplicates deleted, each twin-guarded, 169 remain) →
B2 applied (169 repointed, ids preserved, priority 1) → Batch C Parts A/B
complete (0 city rules, 21 Pankow + 169 district, 8159 total). ABORTS
in-transaction on any count/twin mismatch — nothing applied partially.
After live verification: push 2 = C1+C2 (case backfill + city-office
deactivation), materialized only then (report §VI.3).

## Founder push list — round-2 items 1–6 (DONE 2026-08-13, historical)

1. `20260813000001_berlin_power_of_attorney_required.sql` — item 1. Expect
   NOTICEs: locked-case guard passed → flip applied (52→53) → Essen verified.
   ABORTS if a locked Berlin case without a non-empty Betreuer answer appeared
   since 2026-08-12 (founder decision then — no auto-backfill by design).
2. `20260813000002_locked_card_docs_variant_content.sql` — item 3 content
   rows (4× PLACEHOLDER_DE). Expect NOTICE: 4 rows non-empty.
3. `20260813000003_disability_unlimited_gate.sql` — item 6. Expect NOTICEs:
   rico pre-check passed → 4 shifts asserted (8/54/8/88) → 4 re-gates → rico
   backfilled Nein (stays 100%) → zero orphan expiry answers.

## What was built (branch `golive-round2`)

- **Item 1**: migration 1 + e2e denominator flips 52→53
  (feedback-pass.spec.ts L1/L2 + header, m7-regression.spec.ts ×2 + comment
  rewrites per the verified-reason rule, docs/uat-m7.md rows 3/4/R2 —
  married denominator 92 SIMULATION-VERIFIED, sim calibrated on fresh=52).
  No app code.
- **Item 5**: `lib/date-bounds.ts` (14 future-oriented keys → today+10y,
  everything else keeps (currentYear+1)-12-31); DateInput consumes
  `dateMaxFor(question.key)`; actions.ts threads `qRow.key` into
  `validateAnswerValue`, date case now day-granular ISO compare + strict ISO
  regex (the regex is load-bearing for the lexicographic compare, not
  optional hardening). New `tests/unit/date-bounds.test.ts` (7 tests, pinned
  key-set) + `tests/e2e/date-bounds.spec.ts` (2031 birth date rejected via
  SERVER path, 2031 expiry accepted + lands in DB, max attrs asserted).
- **Item 3**: migration 2 + `components/case-tab-context.tsx` (null-safe
  provider from CaseTabs) + missingDocs threaded page.tsx→ChatView +
  EditLockedCard docs-variant (testids kept; `data-docs-missing` attr;
  `locked-docs-button`; upload step prefixed; ''-guards on heading+body AND
  button) + AllAnsweredCard petrol button (additive, approved recommendation)
  - completion.spec C6 (variant + tab switch, content-compared vs DB rows)
    and C7 (upload-all → byte-identical approved card).
- **Item 6**: migration 3 (4 gates incl. spouse, 4 re-gates, renumbering
  with asserted shift counts, generic backfill + named rico asserts) +
  6 unit tests (gate chain incl. sweep + backfilled-locked shape) +
  `tests/e2e/disability-gate.spec.ts` G1–G4 (gate shows on Ja; unbefristet
  skips expiry; Nein requires it — saves a 2031 date, doubling as an item-5
  check; flip-back sweep DELETES the expiry row). Spec is content-based
  (prompts read from DB) and aborts loudly pre-migration.
- **Item 4**: NO migration (founder decision). German question + repro
  explainer in the Roman package §1.
- **Item 2**: escalation only — proposal in the Roman package §2 + ledger.
- **Ledger**: `german_copy_for_roman.md` round-2 section + Still-open rows.

## Gate + live verification plan (after push + merge)

Standard: full suite vs branch preview (incl. mobile-footer + the two new
specs), then merge, prod deploy, then live:

- **rico read-only render checks** (REAL locked case `52e364f1`, zero
  writes): after the FULL push exactly **77/77 = 100%** (item 1 +1/+1 via his
  non-empty Betreuer answer, item 6 +1/+1 via the backfilled gate — the
  Phase-1 report's cross-item §1; review pass corrected an earlier per-item
  "76/76" here that ignored the ordered composition) with the expiry bubble
  PRESENT in history and the backfilled gate bubble visible; after item 3 the
  locked card shows the DOCS VARIANT with his live missing count
  (3: PAN-016/017/018) and the button lands on the Dokumente tab.
- Throwaway drives: date-bounds spec (2031 expiry / birth date), disability-
  gate spec G1–G4, completion spec C1–C7 (fixture re-seed first), plus the
  denominator anchors (53 Berlin / 49 Essen). Delete throwaways, leak sweep 0.

## Standing constraints honored

- R8: migrations push FIRST; the only code that depends on new DB state is
  test-side (asserts flip with the push) or ''-guarded (item 3 variant).
- Item-6 e2e + completion C6/C7 can only go green AFTER the push (by design,
  content-based readiness).
- Explicit path staging; `main` untouched; branch `golive-round2`.
