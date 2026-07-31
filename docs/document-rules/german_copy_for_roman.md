# German copy for Roman — Essen document rules

> Caregiver-facing strings introduced by the Essen document-rules seed
> (`20260724000001`). Everything here is live once the migration is pushed;
> corrections go through a normal copy migration.

## 1. Instruction text for bank-statement slots — PLACEHOLDER_DE

The Essen rules require bank statements covering the **4 months before the
application date** (`period_months: 4` on ESS-010/011). The app does NOT
compute dates (decision D5) — this is instruction text only, proposed for
the document-area intro or a future per-slot hint:

> **PLACEHOLDER_DE:** "Bitte reichen Sie lückenlose Kontoauszüge der
> letzten 4 Monate vor dem Antragsdatum ein (alle Konten)."

_Not wired into the UI yet — Roman signs off the wording first; wiring is a
one-key static_content addition afterwards._

## 2. The 13 new document names (`user_facing_name_de`, live in the checklist)

| DOC-ID   | name_de (caregiver-facing)                                       | category |
| -------- | ---------------------------------------------------------------- | -------- |
| DOC-0031 | Nachweis Rentenantragstellung                                    | income   |
| DOC-0032 | Bescheid Arbeitslosengeld/JobCenter/Bürgergeld                   | income   |
| DOC-0033 | Bescheid Grundrentenzuschlag oder Grundrentenzeiten              | income   |
| DOC-0034 | Krankengeldbescheid                                              | income   |
| DOC-0035 | Lohnbescheinigung                                                | income   |
| DOC-0036 | Beitragsbescheid freiwillige/private Kranken-/Pflegeversicherung | health   |
| DOC-0037 | Finanzstatus/Saldenübersicht                                     | assets   |
| DOC-0038 | Eigentumsnachweis                                                | housing  |
| DOC-0039 | Nachweis ausländische Krankenversicherung                        | health   |
| DOC-0040 | Nachweise Auslandstätigkeit/Rentenbeiträge                       | income   |
| DOC-0041 | Nachweise sonstiges Vermögen                                     | assets   |
| DOC-0042 | Übertragungsvertrag mit Grundbuchauszug                          | assets   |
| DOC-0043 | Unterhaltsurteil/Titel/Urkunde                                   | person   |

_Names seed verbatim from your rules file. Flag anything to reword and it
ships as a one-line UPDATE migration._

## E-7 (2026-07-31): Lade-Anzeige und 404-Seite — PLACEHOLDER_DE

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
