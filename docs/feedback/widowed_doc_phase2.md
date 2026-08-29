# Widowed → death certificate — Phase 2 (coverage-only execution record)

> 2026-08-29. GATE 1 APPROVED: DONE classification accepted (PAN-025 +
> ESS-056 live and universal via fallback; the founder's "nothing is asked"
> was the unanswered-Familienstand effect, same as Roman's round-2
> observation). Phase 2 commissioned as **test coverage only** — no
> migrations, no app-code changes. Both constraints held: the diff is three
> test files + this record + the Phase-1 report.

## What shipped

1. **F4 widowed fixture** —
   [pankow-answer-fixtures.mjs](../../tests/fixtures/pankow-answer-fixtures.mjs):
   widowed single applicant with a Witwenrente. Deliberately absent from the
   golden files (their loops pin exactly F1–F3), consumed only by the new
   unit file — the existing golden gates are untouched and still green.
2. **Pankow-side unit coverage** —
   [pankow-widowed-death-certificate.test.ts](../../tests/unit/pankow-widowed-death-certificate.test.ts)
   (8 tests), mirroring the ESS-056 shape: snapshot lockstep (PAN-025 +
   DOC-0016 exactly as Phase 1 surveyed), fire/fail-closed (F4 → exactly one
   person_1 "Sterbeurkunde Partner" slot; F1/F2/F3/unanswered → none),
   **universality via the purged fallback list** (the real ladder decision
   still serves PAN-025 — doubling as the unit-level governance tripwire:
   the exclusion fixture must never contain PAN-025), and isolation
   (removing PAN-025 changes nothing else).
3. **E2E** —
   [widowed-death-certificate.spec.ts](../../tests/e2e/widowed-death-certificate.spec.ts),
   modeled on disability-gate.spec.ts: one throwaway Berlin user on PLZ
   10115 (**fallback-served** — the exact shape of the three real widowed
   prod cases). W1: Familienstand = verwitwet → the Sterbeurkunde slot is
   visible on the Unterlagen checklist. W2: editing to ledig removes it on
   the next render while the checklist keeps rendering (display-time
   recompute, end to end). All German (prompt, option, document name) is
   read from the DB at runtime; the readiness block also asserts the live
   `fallback_excluded_rule_ids` does not contain PAN-025 — the standing
   governance rule now has an end-to-end tripwire.

No app bug was revealed by any of the new tests (the gate's STOP condition
never triggered). Unit suite: **284/284** (was 276 + 8 new). tsc + ESLint
clean.

## Full local e2e (chunked; known-flaky local mode)

| Run | Result |
|---|---|
| widowed-death-certificate (new, standalone) | **1 passed** (31.3s), first try |
| Chunk A (9 files incl. the new spec) | 8 passed, 13 skipped (standing auth signup skips), 6 timed out — the documented machine-side stall (page.reload hanging on "Wird geladen …", files at 6–8.5m); **zero app code changed in this pass**, and the same specs passed locally + on preview earlier today |
| fallback-notice re-run (fresh server, workers=2) | **3/3 passed** |
| visibility isolated (workers=1) | **1 passed** (5.2m) |
| transitive-visibility-fix isolated (workers=1) | **3/3 passed** (5.3m) |
| Chunk B: feedback-pass + m7-regression (workers=2) | **7 passed** (7.5m) |
| Chunk C: completion (fresh fixture) + mobile-footer (workers=2) | **2 passed** (2.8m) |

Net: **every spec green locally**, the stalled ones on isolation — the
2026-08-01 local-stall pattern (server + Supabase exonerated then;
reproduced today with byte-identical app code that had passed the full
preview suite an hour earlier). The preview suite below is the gate, per
standing convention. All e2e users admin-created and deleted per-user.

## Preview suite

- RESULTS_PENDING (appended after the branch preview run)

## Ship record

- Branch `feat/widowed-doc-coverage`; staged explicitly: the three test
  files, `docs/feedback/widowed_doc_phase1.md` (per the gate instruction),
  and this record. **Zero migrations, zero app-code files.**
- **HARD STOP after the preview suite — merge is the founder's call.**
