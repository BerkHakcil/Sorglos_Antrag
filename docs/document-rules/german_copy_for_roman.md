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

| item                                                       | home                                      | status                                                                        |
| ---------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Contact-sheet close label „Schließen" (screen-reader only) | de.ts `case.help.closeLabel`              | PLACEHOLDER_DE — ledgered after §4 was assembled, not covered by the approval |
| Lade-Anzeige „Wird geladen …"                              | de.ts (E-7)                               | PLACEHOLDER_DE                                                                |
| 404-Seite (Überschrift/Text/Link/Tab)                      | de.ts (E-7)                               | PLACEHOLDER_DE                                                                |
| Tab-badge word „offen" (`· 4 offen`)                       | not shipped — we render the bare count    | Roman authorship pending (E-2 ledger)                                         |
| Logo originals (SVG/hi-res)                                | `public/logo.jpg` stays                   | Roman delivery pending (D16)                                                  |
| Ansprechpartner photo                                      | `HelpSheet` `photoSrc` drop-in prop ready | Roman delivery pending (D11)                                                  |
| Auth email texts                                           | Supabase dashboard                        | owner-handled by Roman (D14)                                                  |
