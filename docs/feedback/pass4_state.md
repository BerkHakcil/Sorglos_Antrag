# Content Pass 4 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full Phase-A findings:
> `pass4_phase_a.md`; German package: `roman_package_pass4.md`.
> Decisions D1–D16 are locked in the pass brief and are not re-litigated.

## Phase status

| Phase                                  | Status                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only report + Roman Package 2 | ✅ DONE 2026-08-01 — approved same day (all 7 decisions, below)                         | `pass4_phase_a.md` (A1–A9 + appendix order table) + `roman_package_pass4.md`. §4 (new-German nod list) appended to the package per founder item 7 — **package ready to send**                                                                                                                                                                           |
| Batch 1 (D1/D3/D4/D9/D10/D11/D2)       | ✅ **DONE 2026-08-01 — live on prod, all seven spot-checks green**                      | Migrations `20260801000001/2` pushed by founder + verified on prod (twice, incl. post-reboot). Code merged `51a8064`, deployed `dpl_GRFPKP55…`. Gate: cumulative green vs the immutable `9b562c3` preview (deviation recorded below). Live spot-checks: see the Batch-1 record                                                                          |
| Batch 2 (pension, D15)                 | ✅ **DONE 2026-08-01 — live on prod, 12/12 live checks + real-case render check green** | Migrations applied + verified (414/412, pair retired, count-driven, backfills 2/1/0). Code merged `3a09bfc`, deployed `dpl_9ZRqoCM2…`. Gate: 12/13 preview run (zero stalls, 4.2 min) + the fixed V1 green vs the same `5a419f3` deployment (the sole failure was the rewritten spec's own ambiguous-key bug — test-side). Live evidence below          |
| Batch 3 (D5/D6/D12)                    | 🔶 migrations written — **⏸ STOP: awaiting manual `supabase db push`**                  | **Provenance: Package §1–§4 approved by Erman 2026-08-01; Roman review waived.** Gate-1 verify: every §1/§2 target byte-matches live; §4 placeholders already live verbatim → **ledger-only, no migration**; Essen re-scanned clean. `20260801000005` (6 copy rows) + `20260801000006` (GENERATED reorder, 167 rows, dependency-verified). Record below |
| Close-out                              | not started                                                                             |                                                                                                                                                                                                                                                                                                                                                         |

## Decisions received from the founder (2026-08-01) — Phase-A STOP closed

1. Count-decrease = **Option A confirm-and-clear**; dialog text PLACEHOLDER_DE.
2. Backfill **approved as tabled** (instances where present, Ja→1/Nein→0;
   locked Keine-Rente case → 0 with history-row disappearance accepted;
   fixture → 1). Migration-time R2 re-verifies per case; **any drift since
   Phase A stops the migration**.
3. Berlin order **approved incl. all four judgment-call recommendations**
   (funeral trio → Versicherung block, Partner before Kinder, costly_diet
   before the family block, labels gate on Roman/Batch 3). Essen report-only.
4. Pankow suffix: **render wherever `period_months` is non-NULL** — no
   NULLing migration. Live verification must cover a Pankow checklist
   explicitly (PAN-005/006 show "(letzte 4 Monate)").
5. Next-steps: **locked state only**.
6. Contact card: **header-Hilfe sheet** per mockup; trigger + micro-labels
   PLACEHOLDER_DE.
7. All new German consolidated into `roman_package_pass4.md` **§4**
   (appended: confirm dialog, Hilfe/Ansprechpartner labels, Nächste-Schritte
   heading, netto hint) — founder sends the package.

## Original Phase-A STOP decision list (historical, all taken above)

1. **Count-decrease semantics** (A1.3): Option A confirm-and-clear
   (recommended) vs Option B preserve+hide.
2. **Backfill table** (A1.5): approve per-case `pension_count` values, incl.
   `298ac66b` → 0 (its "Keine Rente" history row disappears from the visible
   transcript; rows preserved) and the `88eede8b` fixture conflict
   (recommend 1).
3. **Berlin order** (A2 appendix) + four judgment calls: funeral trio →
   Versicherung block; Partner before Kinder; costly_diet position; the three
   new category labels (also asked of Roman in Package §3).
4. **⚠ D10 premise correction** (A7 / §0.1): PAN-005/PAN-006 carry
   `period_months = 4` on live prod. (a) render suffix on Pankow too
   (recommended, data-faithful) or (b) NULL the two PAN values by migration
   to match the brief's "Pankow shows no suffix" spot-check.
5. **Next-steps placement** (A8): locked-only (recommended) vs both terminal
   states; "Nächste Schritte" heading = PLACEHOLDER_DE pending confirmation.
6. **Contact card placement** (A8): P1 header-Hilfe sheet (recommended) / P2
   static blocks / P3 both.
7. Send `roman_package_pass4.md` to Roman (his answers gate Batch 3 only).

## Key Phase-A facts (so later phases need not re-derive)

- **Live-state deltas vs brief/docs (verified 2026-08-01):** PAN-005/006
  `period_months = 4` (not NULL — D10's premise wrong); **third** folder flip
  DOC-0042 Housing→Financial (with DOC-0005 Insurance→Financial, DOC-0030
  Housing→Financial; new partition assertion Personal 11 / Housing 5 /
  Financial 19 / Insurance 8); uploads now **11** rows / 4 cases, all legacy
  UUID paths (zero new-scheme files → D9 flips strand nothing); D1 copy pair
  byte-identical confirmed in DB (4 static_content rows).
- **A1 headline:** the Berlin pension group already carries Roman's D15c
  German **verbatim** (all four prompts) — no prompt migrations. Changes:
  retire pair, add `pension_count` (options "0"…"8" — new permanent values),
  remove "Keine Rente" option, NULL the three `in_values` member vis rules,
  optional netto `help_de` (PLACEHOLDER_DE).
- **Retirement mechanism:** `question.active` column (Phase-C pattern).
  ⚠ Load-bearing detail: the stale-answer sweep (actions.ts:217) deletes any
  answer row visible in `answersRaw`; the pair's rows are protected by
  filtering the keyMap query in `getCaseAnswers` (dal.ts:98) so they never
  enter `answersRaw`. Loader filter alone would get the answers deleted on
  the next save. `case-export` stays unfiltered on purpose (retired answers
  keep appearing in answers.md).
- **Count-driven design:** `question_group.count_source_key` (nullable,
  data-driven); ONE shared derivation helper — four sites currently derive
  instances independently (page.tsx `deriveGroupData`, actions.ts
  `deriveGroupDataForCompletion` — its zero-UUID placeholder must NOT apply
  to count-driven groups or count=0 blocks completion forever —
  chat-view.tsx state, case-export.mjs). Instance order fixed to earliest
  `created_at`. Doc rules need **zero** migration (PAN-003/004 read the
  capped derivation; count 0 → no slots).
- **Denominators after D15 + D4:** Berlin fresh 53 → **52**
  (−hat_rente −fresh pension_type +pension_count; corrects pass-3 A9's
  "→51" which miscounted rentenbetrag as fresh-visible); Essen fresh 50 →
  **49** (birth_name optional). Asserts to touch: m7-regression :222 (50),
  :292/:323 (53); feedback-pass L1/L2 (53), L3/L4 (50).
- **D1 breaks three text anchors:** `'Sie haben alle Fragen beantwortet'` in
  completion.spec (:105/:320), visibility.spec (:139),
  transitive-visibility-fix.spec (:129) — repoint in Batch 1.
- **A7:** `DocumentSlot.periodMonths` already threaded by the evaluator;
  render sites are exactly document-area.tsx:210 and case-export.mjs:210;
  suffix `(letzte {n} Monate)` display-only (storage-path untouched, no
  counter fork; goldens unchanged).
- **A6:** pre-steps get wrapped in `CaseTabs`; placeholder = new
  static_content row `docs.placeholder_needs_plz` (Roman verbatim, D3);
  badge is already structurally hidden at 0 (case-tabs.tsx:69); safety
  branch (no rules anywhere) keeps chat-alone.
- **A9:** Essen birth_name = question `61000000-0000-0000-0000-000000000005`
  → `is_required = false`; B1 mechanics engine-level, no code change; zero
  Essen cases in prod (R2 trivial).
- **A3:** exactly 5 Berlin violations (2 retire with D15; 3 proposals to
  Roman); Essen clean. **A4:** three Essen spouse bulk intros don't name the
  partner → harmonized proposals to Roman; option labels already "Der
  Partner …". D13 = no change (resolved).
- **Real-data snapshot (2026-08-01):** 12 cases / 21 auth users; pension
  data only on d345b0f9 (REAL in_progress, 2 instances), fc446257 (REAL
  locked, 1), 298ac66b (REAL locked, Keine-Rente instance), 88eede8b (TEST
  fixture, inconsistent hat_rente=Nein + filled instance). Re-run R2 at
  every migration execution time.

## Ledger updates queued (Batch 1, per the brief)

D7 (umlauts/ss) resolved · D8 (13 Essen names) resolved · D13 (Berlin
partner insurance) resolved-no-change · D14 (emails) owner-handled · D10's
old PLACEHOLDER (german_copy_for_roman.md §1, the never-wired 4-month hint)
**removed** · D16 logo stays open (originals pending; WhatsApp thumbnails
unusable, not integrated).

## Batch 1 record

**Migrations (written 2026-08-01, pre-push):**

- `20260801000001_pass4_batch1_copy.sql` — D1 four value-guarded UPDATEs
  (pre-state guard asserts the byte-identical pair, post-check asserts the
  new distinct values) + 11 new `static_content` rows (D3
  `docs.placeholder_needs_plz`, D2 `case.next_steps_heading/_1/_2/_3`, D11
  `contact.name/phone/email/card_label/help_button`, D10 template
  `docs.period_suffix` = "(letzte {n} Monate)"), `ON CONFLICT DO NOTHING`
  per the Essen-seed precedent.
- `20260801000002_pass4_batch1_flags.sql` — D4 Essen `birth_name`
  `is_required=false` (guarded, asserted 1 row) + D9 three
  `storage_category` flips (DOC-0005 Insurance→Financial, DOC-0030 and
  DOC-0042 Housing→Financial, each guarded+asserted) + full partition
  assertion **Personal 11 / Housing 5 / Financial 19 / Insurance 8** (43).

**R2 execution-time re-verification (2026-08-01, read-only, zero drift):**
D1 four rows byte-identical as known; no key collisions for the 11 new rows;
Essen `birth_name` still required with **0 answers / 0 Essen cases**; the
three D9 rows carry exactly the expected old values, partition 11/7/16/9;
**11 uploads, all legacy UUID paths, 0 new-scheme** (flips strand nothing);
period_months confirmed on exactly PAN-005/006/ESS-010/011 = 4.

**Batch-1 code (written 2026-08-01, on branch `pass4-batch1`):** D3
pre-steps wrapped in CaseTabs + `DocsPlaceholder` pane (gating pure helper
`lib/docs-pane.ts`, unit-tested); D10 `periodSuffix` in
`lib/document-rules.ts` (template `docs.period_suffix`, n≥2 only — a
1-month rule would need Roman singular wording first) rendered in
`document-area.tsx` + `case-export.mjs`; D11 `app/case/help-sheet.tsx`
(base-ui Dialog, RP-initials avatar with `photoSrc` drop-in slot,
`contact.*` content; close aria-label "Schließen" = new PLACEHOLDER_DE in
de.ts, ledgered); D2 next-steps on `EditLockedCard` only; e2e: the three
old text anchors → testids (completion/visibility/transitive), Essen
denominators 50→49 (m7-regression, feedback-pass L3/L4); unit 205/205
(195 + 7 periodSuffix + 3 docsPaneMode). Migration-history note: both `20260801…` files applied+tracked
by the founder's push, verified on prod data-level (15/15 rows, partition
11/5/19/8, birth_name optional).

**⚠ Harness finding (2026-08-01) — local e2e gate not viable, cause
unattributed.** Full-suite drives against a LOCAL `next start` (prod
build, prod Supabase) hang mid-drive: a save transition never settles
("Speichern …" stuck `[disabled]`), `waitForIdle` burns 15-s timeouts, the
test dies at 600 s against a perfectly rendered page — the pass-3 L2
signature, now recurring. Evidence chain: first seen with default workers
(20-core machine → ~10 parallel drives), **recurred with `--workers=1`**,
and **recurred on a CLEAN-MAIN build (A/B with the Batch-1 diff stashed)**
— so it is NOT this batch's code. Single-drive probe on the same build:
6 saves, 0.8–1.1 s each. While one hung render was live, the same server
answered fresh requests in 60 ms and Supabase REST in 95–304 ms — the
wedge is per-session (one browser session's `/case` hung deterministically
until a fresh login; token-refresh suspected, NOT verified). Pass-3 local
full-suite runs were green (E-0, `--workers=1`), so this is
new-or-intermittent environment behavior on this machine. Recorded per the
"not reproduced ≠ explained" standard; no primitive changed. **Gate
re-routed to a Vercel preview** (the pass-3 measured-green path, bypass
secret already configured).

**Local verification that DID pass (Batch-1 build):** unit 205/205,
typecheck/lint/format/encoding, production build; browser walkthrough on
the local build — tabs + "Ihre Dokumente" placeholder pre-steps with NO
badge, Hilfe sheet opens with card label/name/tel/mailto and closes
cleanly, badge `· 11` appears after PLZ 13187, and the **Pankow checklist
renders "Kontoauszüge – Girokonto (letzte 4 Monate)"** with every other
slot suffix-free (decision 4 verified locally).

**⚠ Defect found and fixed during the walkthrough:** base-ui Dialog keeps
Backdrop+Popup mounted with `[data-closed]` after close — without styling
that state, the invisible full-screen backdrop swallowed every click on
the page (the closed sheet blocked the pre-step submit). Fix:
`data-closed:hidden` on both (comment in help-sheet.tsx marks it
load-bearing). Verified: closed state computes `display:none`, page
clickable.

**Prod hygiene:** killed-run sweep found only 2 leaked users (afterEach
survived most kills); both verified individually (0 objects, 0/3 answers,
synthetic) and deleted; the active completion fixture kept.

## Next step

**Preview gate, first attempt (2026-08-01 ~13:00) — killed at the 15-min
tripwire; the hang followed the CLIENT, not the code and not the server.**
Branch pushed; preview `dpl_EMTvW1fKXebKX39etNwV9i7H6AbU`
(`sorglos-antrag-9hbjbclr3-…`, commit `9b562c3`, readyState READY in 40 s).
Suite against it: **completion.spec and visibility.spec completed** (final
screenshots, no error contexts — the D1 testid anchors and the locked flow
work end-to-end on the preview), feedback-pass L3/L4 hit save-stalls at
the same drive step and **recovered**, transitive-T1 (420 s) and m7-R1
(600 s) died on the stuck-"Speichern …" signature (m7 frozen at Essen
`legal_guardian_yes_no` with a pending transition). **Decisive
instrument — Vercel runtime logs for the preview deployment over the run
window: 1537 requests, ALL 2xx/3xx, zero errors, zero server-side
timeouts.** The server answered everything that arrived; the stalls sit
between this machine's Chromium and the network. Corroborating: identical
hangs against localhost (no WLAN involved), clean-main local A/B hangs,
trivial node scripts on this box throw libuv teardown asserts today, and
the SAME machine ran the E-7 preview gate green yesterday. Classification:
**machine-side, today-specific, unattributed** — no product assert failed
in any run today; every failure is a stalled save transition against a
correctly rendered page. Leaked users from both killed runs swept
per-user (2 + 2, all synthetic, fixture kept).

**Preview gate, retry after reboot (2026-08-01 ~14:00) — CUMULATIVE GREEN,
recorded as a deviation.** Migrations re-confirmed applied on prod before
the run (fresh read: distinct copy pair live, suffix template +
placeholder rows present, birth_name optional, partition 11/5/19/8 — the
founder's rule-#8 question answered on record: applied, so code merges
after migrations as required). Full suite vs the same immutable deployment
(`9b562c3`): **11 passed / 13 skipped / 2 failed in 15.1 min** — and the
two failures were DIFFERENT specs than attempt 1 (everything that failed
there passed here, incl. transitive T1–T3 and m7 R1/R2). The two failures,
each then re-run alone against the same deployment:

- `feedback-pass` T1 — the day's only assert-class failure (badge stayed
  13 instead of dropping to 12 after an upload). **Re-run: PASS in
  30.8 s**, badge decrement + live spouse slots + pre-completion upload
  all green → the earlier failure was the machine stall eating the upload
  roundtrip, not a decrement regression.
- `documents-m6` — the stall signature mid-QUESTIONNAIRE drive (900 s
  burn at a `clickWeiter`, nowhere near the docs code). **Re-run: PASS in
  2.5 min, all six criteria** incl. A4's full counter cycle and 17 real
  uploads, cleanup verified.

**⚠ Deviation on record:** the gate is satisfied CUMULATIVELY (one
11/13-run + two green single-spec re-runs against the same deployment),
not by a single all-green run — the machine stalls persist post-reboot
(stuck-screenshots re-written this run; stalls recovered mid-drive in
m7/L3/L4). Justification: the deployment is immutable, no product assert
failed twice, every failure re-ran green, the stall class is attributed
to this machine (lambda logs all-2xx across 1537 requests), and the
pass-3 tripwire convention explicitly prefers a documented fallback over
blocking on non-product harness failures. If the stalls recur on a
healthy machine, the `waitForIdle` global-disabled-count primitive is the
flagged suspect (pass-3 backlog item 4) — replace it with per-control
waits before burning another day.

**LIVE spot-checks on prod (2026-08-01, deployment `dpl_GRFPKP55…` =
merge `51a8064`; three throwaway users + one drive user, all deleted):**

1. ✅ Placeholder before PLZ — tabs at first login, D3 text **verbatim**
   in the Dokumente pane, and NO badge (structural). One probe artifact
   on record: the instant `isVisible` check fired before hydration and
   read false, while the very next action clicked that tab successfully
   and captured the placeholder — feature proven, check timing was wrong.
2. ✅ List after PLZ 13187 — full checklist, numeric badge `11`.
3. ✅ Essen 45127 — "Kontoauszüge … (letzte 4 Monate)" on the ESS
   checklist.
4. ✅ **Pankow 13187 — "Kontoauszüge – Girokonto (letzte 4 Monate)"**
   (decision 4), and exactly ONE suffix occurrence on the fresh checklist
   (no leakage onto non-bank slots).
5. ✅ Distinct copy pair: the all-answered card was caught in-session
   ("Alle Fragen beantwortet" + the new body), the locked card after
   reload shows "Ihr Antrag wird geprüft" + "Sie müssen nichts weiter
   tun…", old shared heading absent. A probe DB-read raced the final
   save's commit and momentarily saw `in_progress` — disproven by the
   locked banner itself, which only renders when the server sees
   `under_review` (and by completion.spec's C2 on the same build).
6. ✅ Contact sheet — opens from the header, carries "Ihr Ansprechpartner"
   (CSS-uppercased — the probe's case-sensitive match flagged it, text
   correct), RP avatar, Roman Pfeiffer, tel + mailto. Closes cleanly
   (the `data-closed` fix held on prod).
7. ✅ Next-steps ABSENT from the all-answered card, PRESENT on the locked
   card with the heading and all three bullets verbatim.

The machine-stall condition struck twice more during the checks (one save
stall, one reload stall) and recovered within the tolerant waits — still
machine-side, still on record.

**Ledger updates shipped with Batch 1:** D7/D8/D13/D14 dispositions
recorded; `german_copy_for_roman.md` — rejected D10 hint removed (§1),
the 13 names marked signed off (§2), pass-4 PLACEHOLDER_DE table added
(Hilfe/Ansprechpartner labels, Nächste-Schritte heading, Schließen
aria-label, Batch-2 confirm dialog + netto hint).

## Batch 2 — engine + tests record (2026-08-01, branch `pass4-batch2`)

**Retirement (question.active):** loader filter in
`lib/questionnaire-engine.ts` (retired questions never load) + the
LOAD-BEARING keyMap filter in `lib/dal.ts` `getCaseAnswers` — retired
answers never enter `answersRaw`, so the stale-answer sweep cannot delete
them (comment marks it explicitly). `case-export` deliberately stays
unfiltered: answers.md keeps showing preserved retired answers to ops.

**Count-driven groups — the FOUR derivation sites, all through the new
shared `lib/group-instances.ts` (cited per the founder's gate item 2):**

1. `app/case/page.tsx` — `deriveGroupData(questionnaire, answersRaw,
'render')` (auto-create-1 for classic groups; count groups exactly N).
2. `app/case/actions.ts` (completion gate) — mode `'completion'`
   (zero-UUID placeholder for classic groups; count groups get NO
   placeholder — count 0 must not block completion).
3. `app/case/chat-view.tsx` — client adjustments via the exported
   `capInstances`/`parseCount`: saving a count-source question truncates/
   extends the driven group's instance list in the same render; a DECREASE
   below the number of FILLED instances first shows the confirm-and-clear
   card (`data-testid=count-decrease-confirm`, PLACEHOLDER_DE strings in
   de.ts per the nod list); rollback restores the previous list on save
   failure. The per-instance "Eintrag entfernen" affordance is suppressed
   for count-driven groups (the count is the single source of instance
   count).
4. `scripts/case-export.mjs` — mode `'export'` feeds the CAPPED derivation
   to `evaluateDocumentRules` (documents.md mirrors the app's slots) while
   answers.md iterates the RAW uncapped collection (ops keeps seeing e.g.
   the locked Keine-Rente instance).

Instance order is deterministic: `getCaseAnswers` now orders answer rows
by `created_at`, so count truncation drops the NEWEST instances. The
add-another prompt is suppressed for count groups in `buildNav`;
`verify-baseline` gained both new columns in its drift guard and swapped
its critical-keys spot-check to `pension_count`/`pension_type`.

**Doc rules:** ZERO rule changes — PAN-003/004 read the capped derivation;
count 0 → no pension slots (proven in unit); Essen untouched (evaluator
unchanged; 53/53 doc-rule tests green with goldens byte-identical after
removing the inert `hat_rente` keys from the Pankow fixtures).

**Tests:** unit 219/219 (14 new in `group-instances.test.ts`: parse/cap,
per-mode derivation, truncate-keeps-oldest, denominator math, unanswered
Abrechnungsnummer blocks completion, prompt suppression + classic-group
regression, PAN-003 slots follow the cap incl. the count-0 Keine-Rente
shape). e2e rebuilt: visibility V1 = count-driven (STRUCTURAL detection
of the count select by option values — no copy coupling; asserts 2
instances in DB, prompt never seen, retired pair `active=false`, zero
`hat_rente` answers saved), documents-m6 drives `pension_count='2'` via
the override map and FAILS LOUDLY if the pension loop prompt ever
reappears, Berlin denominators 53 → **52** (m7 ×2, feedback-pass L1/L2).

**waitForIdle REPLACED (founder item 4; precedent: networkidle removal
`53fdf73`, pass-3 backlog item 4, promoted after the Batch-1 stall
recurrences):** all six specs now use `waitForFooterSettled` — an
`expect(...).toHaveCount(0)` on `[data-testid=answer-footer]
button[disabled]`, the specific state each drive step actually needs,
instead of a global document-wide disabled-button count that any stray
busy control could wedge.

## Batch 2 — live verification on prod (2026-08-01, deployment `dpl_9ZRqoCM2…` = merge `3a09bfc`)

**Throwaway Berlin `count=2` drive — 12/12 checks green:** fresh
denominator **52** → `pension_count = 2` (found structurally) →
denominator **60** → instance 1 (Altersrente, 800) → **reload mid-group
resumed exactly on the open Abrechnungsnummer** → empty Weiter on it
BLOCKED with the German error (required-field gate) → instance 2 rendered
immediately with NO prompt (Unfallrente, 300) → Dokumente tab showed
**exactly two Rentenbescheid slots** ("Rente 1: Altersrente" / "Rente 2:
Unfallrente") → DB held count="2" + 2 instances × 4 answers → **decrease
2→1 via Bearbeiten** surfaced the confirm card with the PLACEHOLDER copy
("Angaben löschen?…überzähligen Renten") → "Ja, löschen" → DB showed
count="1", instance-2's 4 rows DELETED by the sweep, denominator **56**,
exactly ONE slot left. User deleted.

**Read-only render check of backfilled REAL case `d345b0f9`** (actual lib
code over the app's exact load path, zero writes): the two retired
answers exist in the DB but are excluded from `answersRaw` (sweep-proof),
`pension_count = "2"` renders exactly 2 instances / 8 member questions,
retired keys absent from `flatVisible`, and instance 2's preserved data
(Unfallrente / 22 / 2323) renders with its real `pension_issuer` gap open.
One check premise corrected on the record: resume targets
`id_expiry_date` — an EARLIER real gap in this case — because resume is
first-unanswered-in-flow-order by spec; my original expectation
(pension_issuer) assumed the pension gap was the only one. The pension
gap is in `flatVisible`, unanswered, and will be asked in order.

Hygiene: fixture re-seeded; leak sweep found **zero** candidates (every
gate/live run cleaned up after itself).

## Batch 3 — migration round (2026-08-01, pre-push)

**Provenance of record: `roman_package_pass4.md` §1–§4 APPROVED AS
PROPOSED by Erman 2026-08-01; Roman review waived** (if Roman later
approves directly, this line changes to reflect it). The proposed texts
are final copy, seeded character-for-character.

**Gate-1 verification (read-only, execution time):** all §1 Berlin
targets and §2 Essen targets byte-match the package's "live" column —
zero drift since Phase A; the retired pair needs nothing (D15); Essen
perspective re-scan still clean (zero `pflegebedürftig` prompts). **§4:
every live placeholder (`Hilfe`, `Ihr Ansprechpartner`, `Nächste
Schritte`, netto hint, the de.ts confirm-dialog strings) is already
byte-identical to the approved proposal → resolution is LEDGER-ONLY, no
migration** — the PLACEHOLDER_DE markers clear at close-out. The
"Schließen" close aria-label was ledgered after §4 was assembled and is
NOT covered by this approval — it stays PLACEHOLDER_DE.

**`20260801000005_pass4_batch3_copy.sql`:** D5 — the three surviving
Berlin third-person prompts → the approved second-person forms; D12 — the
three Essen spouse intros → the approved partner-naming mirrors
("absetzbaren" drops with the approval). Six value-guarded UPDATEs,
each asserted.

**`20260801000006_pass4_batch3_reorder.sql` (GENERATED from the approved
appendix + the fresh live dump):** all 167 active Berlin questions get
explicit (category, sort) — ids never change; three approved labels
("Wohnung und Heim", "Einkommen", "Versicherung und Pflege" — plus
"Partner, Familie und Unterhalt") set with old-label guards; emptied
`einkommen` (retired-pair holder) and `kinder` categories renumbered to
the end; the children group follows its questions; a final SQL assertion
compares the resulting 167-key flow sequence to the approved appendix
string. **Dependency constraint re-verified programmatically against
LIVE visibility rules at generation time: every controller precedes its
dependents** (generation aborts otherwise).

**Real-Data report — resume positions of in_progress Berlin cases under
the new order (computed with the real lib code, read-only):**

| case                        | class | answered | OLD resume                   | NEW resume                                                                                                                                                                                 |
| --------------------------- | ----- | -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| c8542a35 (bhakcil@)         | REAL  | 4/52     | last_residence_street (6/54) | **district_of_birth (5/54)** — the only key change: the address block moved into Wohnung und Heim, so an earlier personal question comes first. Expected block-jump, accepted per the gate |
| dc56a9cb (romanpfeiffer75@) | REAL  | 0/52     | first_name (1/54)            | first_name (1/54)                                                                                                                                                                          |
| c1bdaaa7 (onurhankirec@)    | REAL  | 1/52     | last_name (3/54)             | last_name (3/54)                                                                                                                                                                           |
| de69f275 (roman.pfeiffer@)  | REAL  | 1/52     | last_name (3/54)             | last_name (3/54)                                                                                                                                                                           |
| d345b0f9 (info@)            | REAL  | 82/124   | id_expiry_date (15/126)      | id_expiry_date (12/126)                                                                                                                                                                    |
| deb82390 (pw-vis-stale)     | TEST  | 3/54     | first_name                   | first_name                                                                                                                                                                                 |

Locked cases: resume N/A (no save path). No case loses answers; the
denominators are order-invariant.

**Text-anchor census for the rewordings + labels: ZERO e2e/heuristic
breaks.** The only grep hits are a synthetic label inside
`group-instances.test.ts` (test-local) and the FROZEN historical
generator `generate-baseline-migration.mjs` (untouched by policy, R5).
Every drive is decoupled: testid anchors, DB-loaded prompt maps,
structural count-select detection, and the T1 matcher words
(vertriebenen/spätaussiedler/familienstand) are all unchanged.

## Next step

**⏸ STOP — founder reviews + `supabase db push`** (two files:
`20260801000005` + `20260801000006`). Expected NOTICEs: D5 applied → D12
applied → reorder 167 questions → categories renumbered + labels →
children group moved → final order verified. Then: no dependent code
(the engine is order-agnostic — R8 trivially satisfied; zero anchors to
update per the census), full suite against prod or a no-op branch
preview per the standing gate, live verification (item 6), and the pass
CLOSE-OUT (item 7) in the same session.
