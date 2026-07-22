# M7 UAT script — human test cases before go-live

> Run by the founders on **https://sorglos-antrag.vercel.app** (pilot URL).
> Use real devices where stated. Each case: fresh signup with an email you can
> receive. Record results in the tables; a case passes when every checkpoint
> matches. Delete test accounts afterwards per `docs/operations.md` §4 (or ask
> the dev to). Automated coverage already exists for all of this
> (`tests/e2e/`); these runs prove it **as a real user, on real hardware**.

## Case 1 — Pankow, married, 2 pensions, documents (run from a real phone)

Signup → questionnaire → completion → uploads, all on a phone (the target
audience's device).

| #   | Step                                                                                                                            | What you should see                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open /signup, register with a fresh email, all 4 consents                                                                       | Success screen: "Bitte bestätigen Sie Ihre E-Mail-Adresse…"                                                                                                                                                                     |
| 2   | Open the confirmation email                                                                                                     | Sender "Sorglos Antrag" <…@sorglosantrag.de>; the link lands you logged in on the case page. ⚠ The template text is a placeholder until Roman's copy is in — judge delivery + link, not wording                                 |
| 3   | Pick any care home, enter PLZ **13187**                                                                                         | Berlin questionnaire starts; progress shows **"0 von 53 Fragen beantwortet"**; the **"Fragen \| Dokumente" tabs** are visible immediately, Dokumente carrying a count badge (feedback pass: checklist from first login)         |
| 4   | Answer through; at Familienstand pick **verheiratet**                                                                           | Progress denominator grows to **92** (spouse section appears); switching to Dokumente now also shows "Unterlagen Ihres Partners" slots — they appear live, before completion                                                    |
| 5   | At "Erhält die pflegebedürftige Person Rente?" answer **Ja**; add **2 pensions** (answer the group, then "Ja, hinzufügen" once) | Loop prompt reads "Möchten Sie weitere Renten hinzufügen?"                                                                                                                                                                      |
| 6   | At "Haben Sie einen Schwerbehindertenausweis?" answer **Nein**                                                                  | The later checklist must NOT contain a Schwerbehindertenausweis slot                                                                                                                                                            |
| 7   | Complete all questions                                                                                                          | Locked banner; chat locks; the Dokumente tab keeps working (uploads are independent of questionnaire state)                                                                                                                     |
| 8   | Document area header                                                                                                            | Counter: "Es fehlen noch {n} Dokumente." with n = number of slots; **two** "Renten/Pensionsbescheid" slots (Rente 1 / Rente 2); spouse section ("Unterlagen Ihres Partners") with Personaldokument, pension and Girokonto slots |
| 9   | Upload a photo **taken with the phone camera** (iPhone = HEIC) to one slot                                                      | Accepted; slot shows "1 Datei(en) hochgeladen"; counter decrements by 1                                                                                                                                                         |
| 10  | Upload a PDF to another slot; then delete it                                                                                    | Counter −1 then +1; file row appears/disappears without full page reload                                                                                                                                                        |
| 11  | Try a Word file (.docx) and a >15 MB file                                                                                       | Both rejected with the German error messages; counter unchanged                                                                                                                                                                 |
| 12  | Log out, log back in                                                                                                            | Everything persisted: answers, status, uploads, counter                                                                                                                                                                         |

Result: ☐ PASS ☐ FAIL — notes: \***\*\_\_\_\_\*\*** · device/browser: \***\*\_\_\_\_\*\***

## Case 2 — Essen questionnaire, default (Pankow) checklist

| #   | Step                                                               | What you should see                                                                                                                                     |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fresh signup, care home, PLZ **45127**                             | Essen questionnaire: first question "Wie lautet Ihr Nachname?", progress **"0 von 50 Fragen"**; **Dokumente tab present from login** (default rule set) |
| 2   | Drive to completion (single path is fine; use bulk options freely) | Bulk topic selections reveal matching detail questions; "Nein, nichts davon" clears other selections                                                    |
| 3   | Complete, open Dokumente, upload one file                          | The checklist shows the **default (Pankow) document set** (feedback-pass founder decision — over-collection accepted) and the upload succeeds           |

Result: ☐ PASS ☐ FAIL — notes: \***\*\_\_\_\_\*\***

## Case 3 — unmapped PLZ falls back to Berlin

| #   | Step                                                                          | What you should see                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fresh signup, care home, PLZ **66606** (St. Wendel — no questionnaire mapped) | Berlin questionnaire loads and is answerable, **"0 von 53 Fragen"**, **no warning banner** (silent fallback is by design); Dokumente tab present (default rule set) |
| 2   | Answer 3–4 questions, reload                                                  | Answers persisted, flow resumes at the next open question                                                                                                           |

Full completion not required. Result: ☐ PASS ☐ FAIL — notes: \***\*\_\_\_\_\*\***

## Appendix — founder pilot (the real case)

Same flow as Case 1 but with a **real care-home resident's data**, entered by
Roman (or with the relative), through to the locked/under-review status +
document uploads. Then:

1. Dev runs `npm run case:export -- <case_id>` and hands Roman the folder —
   Roman confirms `answers.md` + `files/` are sufficient to fill the official
   PDF by hand. **This confirmation is the M7 acceptance.**
2. Data handling: the pilot person can request deletion at any time — the full
   erasure path (storage first, then user, cascade-verified) is
   `docs/operations.md` §4 and was proven in the M7 audit. Tell them this
   before starting.
3. Record: case id, date, export handed over ☐, PDF fillable from export
   ☐ YES ☐ gaps: \***\*\_\_\_\_\*\***

## Result log

| Case           | Date | Tester | Device | Result |
| -------------- | ---- | ------ | ------ | ------ |
| 1 Pankow phone |      |        |        |        |
| 2 Essen        |      |        |        |        |
| 3 Fallback PLZ |      |        |        |        |
| Pilot          |      |        |        |        |
