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

## Pass 4 / Batch 1+2 (2026-08-01) — PLACEHOLDER_DE, asked in `roman_package_pass4.md` §4

All shipped (or shipping) as marked placeholders so features don't wait on
copy; every word is Roman's to replace via one-line migration.

| where                                                   | key / home                                 | placeholder                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header button opening the contact sheet (D11)           | `static_content` `contact.help_button`     | „Hilfe"                                                                                                                                                                   |
| Contact-card label (D11)                                | `static_content` `contact.card_label`      | „Ihr Ansprechpartner"                                                                                                                                                     |
| Heading over the 3-step list, locked state (D2)         | `static_content` `case.next_steps_heading` | „Nächste Schritte"                                                                                                                                                        |
| Confirm dialog on pension_count decrease (D15, Batch 2) | de.ts (client dialog)                      | Titel „Angaben löschen?" · Text „Sie haben die Anzahl der Renten verringert. Die Angaben zu den überzähligen Renten werden dabei gelöscht." · „Ja, löschen" / „Abbrechen" |
| Netto hint under `pension_amount` (D15, Batch 2)        | `question.help_de`                         | „Bitte geben Sie den Nettobetrag an."                                                                                                                                     |

Roman-approved verbatim (NOT placeholders, recorded for completeness): the
D1 copy pair, the three D2 bullets, the D3 pre-PLZ placeholder
(`docs.placeholder_needs_plz`), contact name/phone/email, the D10 suffix
example wording.
