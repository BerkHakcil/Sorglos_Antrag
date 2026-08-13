# German copy for Roman — running ledger

> Caregiver-facing strings that originated from the developer side
> (PLACEHOLDER_DE) or need Roman's sign-off. Corrections ship as one-line
> UPDATE migrations (static_content / question rows) or de.ts edits.

## 1. ~~Instruction text for bank-statement slots~~ — REJECTED, removed (pass 4, D10)

The generic hint ("Bitte reichen Sie lückenlose Kontoauszüge der letzten 4
Monate…") was never wired and Roman rejected it 2026-07-31. Replaced by the
per-office period suffix rendered from `office_document_rule.period_months`
at render time (template `docs.period_suffix` = "(letzte {n} Monate)", from
Roman's approved example "Kontoauszüge – Girokonto (letzte 4 Monate)").

## 2. The 13 new document names (DOC-0031…0043) — ✅ SIGNED OFF (pass 4, D8)

Approved as live 2026-07-31. Historical list in git history; names are in
`document_catalog.name_de`.

## E-7 (2026-07-31): Lade-Anzeige und 404-Seite — PLACEHOLDER_DE (open)

Zwei Zustände, die es vorher gar nicht gab, brauchen je ein paar Worte.
Die folgenden Entwürfe sind **mechanische Platzhalter** (in
`lib/strings/de.ts`, markiert `PLACEHOLDER_DE`) — jedes Wort ist deins.

**Lade-Anzeige** (nur für Screenreader hörbar, sonst ein Kreisel):

> **PLACEHOLDER_DE:** „Wird geladen …"

**404-Seite** (unbekannte Adresse aufgerufen):

> **PLACEHOLDER_DE (Überschrift):** „Seite nicht gefunden"
> **PLACEHOLDER_DE (Text):** „Diese Seite gibt es nicht oder sie wurde verschoben."
> **PLACEHOLDER_DE (Link zurück):** „Zu meinem Antrag"
> **PLACEHOLDER_DE (Browser-Tab):** „Seite nicht gefunden – Hilfe zur Pflege"

## Pass 4 (2026-08-01) — ✅ RESOLVED: `roman_package_pass4.md` §1–§4 approved as proposed by Erman 2026-08-01; Roman review waived

The former §4 placeholders are now **final copy** (live values verified
byte-identical to the approved proposals — no migration was needed): the
Hilfe button word, the „Ihr Ansprechpartner" card label, the „Nächste
Schritte" heading, the count-decrease confirm dialog (de.ts) and the netto
hint on `pension_amount`. Also final via the same approval: the three D5
Berlin rewordings, the three D12 Essen partner intros, and the D6 section
labels („Wohnung und Heim", „Einkommen", „Versicherung und Pflege",
„Partner, Familie und Unterhalt"). If Roman later rewords any of these,
each is a one-line copy migration.

## Still open (PLACEHOLDER_DE or Roman-owned)

| item                                                       | home                                                                                                                       | status                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Contact-sheet close label „Schließen" (screen-reader only) | de.ts `case.help.closeLabel`                                                                                               | PLACEHOLDER_DE — ledgered after §4 was assembled, not covered by the approval   |
| Lade-Anzeige „Wird geladen …"                              | de.ts (E-7)                                                                                                                | PLACEHOLDER_DE                                                                  |
| 404-Seite (Überschrift/Text/Link/Tab)                      | de.ts (E-7)                                                                                                                | PLACEHOLDER_DE                                                                  |
| Tab-badge word „offen" (`· 4 offen`)                       | not shipped — we render the bare count                                                                                     | Roman authorship pending (E-2 ledger)                                           |
| Logo originals (SVG/hi-res)                                | `public/logo.jpg` stays                                                                                                    | Roman delivery pending (D16)                                                    |
| Ansprechpartner photo                                      | `HelpSheet` `photoSrc` drop-in prop ready                                                                                  | Roman delivery pending (D11)                                                    |
| Auth email texts                                           | Supabase dashboard                                                                                                         | owner-handled by Roman (D14)                                                    |
| Fallback-Listen-Hinweis (Banner über der Standard-Liste)   | static_content `docs.fallback_notice`                                                                                      | PLACEHOLDER_DE — see the go-live section below                                  |
| Locked-Card Dokumente-Variante (4 Texte)                   | static_content `case.locked_docs_heading` / `case.locked_docs_body` / `case.locked_docs_button` + `case.next_steps_upload` | PLACEHOLDER_DE — round-2 section below (item 3)                                 |
| Unbefristet-Gate (2 Fragen ×2 Fragebögen)                  | question `disability_card_unlimited` / `spouse_…` prompt_de                                                                | PLACEHOLDER_DE — round-2 section below (item 6)                                 |
| Vertriebenen-Behörden-Frage Klarstellung                   | question `special_origin_rights_issued_by` (+ Partner)                                                                     | PROPOSAL for Roman — round-2 section below (item 2), no change without his word |
| Berliner Bezirksamts-Namen (11 Ämter)                      | `social_office` rows, Migration `20260813000004`                                                                           | OFFICIAL designations seeded (berlin.de) — confirm-or-correct, round-2 package point 6; render user-facing nowhere (sole consumer: ops case-export) |
| Marzahn-Hellersdorf Regelwerk (eigene Dokumentenliste)     | `office_document_rule` (does not exist yet)                                                                                | BACKLOG — first real customer lives there (PLZ 12687); natural next office once Roman confirms demand. Until then his checklist is deliberately the fallback set + banner (Batch C, D-7) |

## Go-live (2026-08-09): Hinweis-Banner für die Standard-Dokumentenliste — PLACEHOLDER_DE (open)

Fälle, deren Postleitzahl (noch) keine amtsspezifische Dokumentenliste hat,
sehen ab jetzt die Standard-Liste **mit einem Hinweis darüber** (sage
Info-Panel über der ersten Dokumentgruppe; Pankow- und Essen-Fälle sehen ihn
nie). Text ist ein **mechanischer Platzhalter** (static_content
`docs.fallback_notice`, Migration `20260809000001`) — jedes Wort ist deins;
eine Umformulierung ist eine Ein-Zeilen-UPDATE-Migration.

> **PLACEHOLDER_DE:** „Hinweis: Für Ihre Postleitzahl liegt uns noch keine
> spezifische Dokumentenliste vor. Diese Übersicht zeigt die üblicherweise
> benötigten Unterlagen — Ihr zuständiges Sozialamt kann zusätzliche oder
> abweichende Dokumente verlangen."

## Go-live round 2 (2026-08-13) — PLACEHOLDER_DE (open)

Volltext der Vorschläge + Kontext im Paket `docs/feedback/roman_package_round2.md`
(eine Nachricht, versandfertig). Jedes Wort ist deins; jede Umformulierung ist
eine Ein-Zeilen-UPDATE-Migration.

**Item 3 — Locked-Card, wenn noch Unterlagen fehlen** (static_content,
Migration `20260813000002`):

> **PLACEHOLDER_DE (Überschrift, `case.locked_docs_heading`):** „Es fehlen noch Unterlagen"
> **PLACEHOLDER_DE (Text, `case.locked_docs_body`):** „Sie haben alle Fragen beantwortet — vielen Dank. Damit wir Ihren Antrag prüfen können, laden Sie bitte noch die fehlenden Unterlagen hoch."
> **PLACEHOLDER_DE (Button, `case.locked_docs_button`):** „Zu den Dokumenten"
> **PLACEHOLDER_DE (Schritt 1 der Nächste-Schritte-Liste, `case.next_steps_upload`):** „Sie laden die noch fehlenden Unterlagen hoch."

**Item 6 — Unbefristet-Gate vor der Ablaufdatum-Frage** (question rows,
Migration `20260813000003`; Berlin + Essen, Antragsteller + Partner):

> **PLACEHOLDER_DE (Antragsteller):** „Ist der Ausweis unbefristet gültig?"
> **PLACEHOLDER_DE (Partner):** „Ist der Ausweis Ihres Partners unbefristet gültig?"
> Offene Stilfrage an Roman: Die Essener Nachbarfragen sagen durchgehend
> „Schwerbehindertenausweis oder Feststellungsbescheid" — sollen die Essener
> Gate-Fragen das Wort „Ausweis" entsprechend ausschreiben?

**Item 2 — Klarstellung „Welche Behörde hat den Ausweis ausgestellt?"**
(NUR Vorschlag — Romans eigener cp3-Text; ohne seine Freigabe ändert sich
nichts):

> **Vorschlag (Antragsteller):** „Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis ausgestellt?"
> **Vorschlag (Partner):** „Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis Ihres Partners ausgestellt?"
> Optional für Symmetrie: die beiden „Wann wurde der Ausweis ausgestellt?"-Fragen analog.
> Alternative: Prompts unverändert lassen, stattdessen je eine help_de-Zeile
> ergänzen, die den Ausweis benennt (beide help_de sind heute NULL).

**Batch C — Berliner Bezirksamts-Namen** (`social_office` rows, Migration
`20260813000004`): Die 11 neuen Ämter tragen die **offiziellen Bezeichnungen**
(„Bezirksamt <X> von Berlin – Amt für Soziales"; Quelle: Senatsverwaltung,
berlin.de „Zuständige Ämter" — im Migration-Header zitiert). KEINE
Platzhalter — amtliche Namen per Founder-Entscheid D-1; Roman bestätigt oder
korrigiert (Paket Punkt 6). Die Namen erscheinen nirgends nutzerseitig
(einziger Renderer: Ops-Export `scripts/case-export.mjs`). Dazu im Paket:
die D-3-Randnotiz (vier Grenz-PLZs bleiben bei Pankow, geänderter Kontext
seit Juli) und der Ops-Hinweis zu rico/Marzahn-Hellersdorf (Punkt 7).
