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

## 2026-08-13 — item-3 waiver: EVERY open placeholder approved

**Provenance of record: approved by Erman 2026-08-13, Roman review waived**
("approve all", incl. the 11 official Berlin office names and the item-2
wording clarification). Resolved as FINAL COPY at their live values — any
later rewording by Roman is a one-line UPDATE migration / de.ts edit:

- Contact-sheet close label „Schließen" (de.ts `case.help.closeLabel`)
- Lade-Anzeige „Wird geladen …" + the 404-Seite set (de.ts, E-7)
- Tab-badge word „offen" — **now SHIPPED** as „· 4 offen" (case-tabs.tsx +
  de.ts `case.tabs.badgeOpenWord`; had been withheld as unauthored German)
- Fallback-Listen-Hinweis (static_content `docs.fallback_notice`)
- Locked-Card Dokumente-Variante, all 4 texts (static*content
  `case.locked_docs*\*`+`case.next_steps_upload`)
- Unbefristet-Gate, both prompts × both questionnaires (the package's open
  Essen style question — „Schwerbehindertenausweis oder
  Feststellungsbescheid" ausschreiben? — is closed by the waiver: texts
  stay as live)
- Vertriebenen-Behörden-Frage — **APPLIED** as proposed incl. spouse
  mirror, migration `20260813000006` (the optional „Wann…" symmetry
  deliberately not taken)
- Berliner Bezirksamts-Namen (11 Ämter, migration `20260813000004`)

**Also decided 2026-08-13 (Roman's answers to the round-2 package):**

- **ESS-056 shipped** (item 1): Essen requires the Sterbeurkunde des
  Partners for widowed applicants — migration `20260813000007`, DOC-0016,
  condition `marital_status = verwitwet`. ⚠ Workbook deviation on record:
  the canonical master tags DOC-0016 „Pankow"-only — approved override,
  noted in `essen_document_rules.json` (rule entry + meta); the workbook
  update itself is Roman's.
- **Case-`52e364f1` dates CLOSED** (item 5 follow-up): Roman says leave the
  twin „2027-08-11" values as they are — the customer re-confirmation ask
  is withdrawn, no data touched. (The `20260813000003` sequencing rule is
  moot since that migration is long applied.)

## 2026-08-14 — UI round 2 (Sidebar-Design): mockup-adopted wording, waived

Provenance for every row below: **"approved by Erman 2026-08-14, Roman review
waived"** (founder decision D4). These are **final copy, not PLACEHOLDER_DE** —
each is lifted verbatim from Roman's own Lovable mockup, so the wording is
already his in origin. A later rewording is a one-line copy migration (DB rows)
or a `de.ts` edit, as usual.

| #   | German                                                                                                            | Lands in                                       | Replaces                                   | Sub-phase |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | --------- |
| 1   | `Angaben`                                                                                                         | `de.ts` `case.tabs.questions`                  | „Fragen"                                   | R2-1      |
| 2   | `Unterlagen`                                                                                                      | `de.ts` `case.tabs.documents`                  | „Dokumente"                                | R2-1      |
| 3   | `Antrag für {first_name} {last_name}`                                                                             | `static_content` `case.header_title_pattern`   | additive; fallback stays `case.subheading` | R2-2      |
| 4   | `Laden Sie die Unterlagen hoch, die Ihnen bereits vorliegen. Wir prüfen alles und melden uns, falls etwas fehlt.` | `static_content` `case.header_intro_documents` | additive                                   | R2-2      |
| 5   | `Ihre Angaben werden automatisch gespeichert. Sie können jederzeit pausieren.`                                    | `static_content` `case.autosave_notice`        | additive                                   | R2-3      |
| 6   | `Antwort speichern`                                                                                               | `de.ts` `case.chat.nextButton`                 | „Weiter"                                   | R2-3      |
| 7   | `Später beantworten`                                                                                              | `de.ts` `case.chat.skipButton`                 | „Weiß ich gerade nicht"                    | R2-3      |

Rows 3–5 ship in migration `20260814000001_ui_round2_header_content.sql`.
**✅ ALL SEVEN LIVE on prod since 2026-08-14** (migration pushed and verified
5/5; renames deployed with the round). Row 8 below is R2-7's marker, which
needed **no new string at all** — it reuses row 7.

| 8 | `Später beantworten` (marker for a deferred question in the transcript) | reuses row 7's `de.ts` string | additive, display-only | R2-7 |

**Deliberately NOT changed** (the waiver covers adopted strings, not
replacements of Roman's authored content):

- The **Angaben** intro line reuses his existing `case.patient_banner_body`
  verbatim instead of the mockup's near-identical sentence (F2). His grammar
  wins; no row added.
- The mockup's second Unterlagen sentence „Vor der Einreichung fragen wir Sie
  immer nach Ihrer Freigabe." is **not adopted** (F3) — it promises an approval
  step the product does not have.
- „Datei hochladen" stays (F4) — accurate, and his row.
- **E-8 closed 2026-08-14:** the pill chips, the „Antwort geändert" flash and
  the Stift-statt-„Bearbeiten" affordance are **dropped permanently** — no
  German is needed for any of them. They revive only if Roman asks.
- ⚠ **Vocabulary mismatch, on the record (F5):** the navigation now says
  **„Unterlagen"** while the pane's own rows keep **„Dokumente"** („Ihre
  Dokumente", „Es fehlen noch {n} Dokumente.", „Alle erforderlichen Dokumente
  sind hochgeladen.", the locked-card docs texts). Founder decision: leave as
  is for now. Harmonizing is one content migration over ~8 `static_content`
  rows whenever Roman cares.

## Still open (the whole list)

| item                                                   | home                                           | status                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ansprechpartner photo                                  | `HelpSheet` `photoSrc` drop-in prop ready      | Roman will send later (his word, 2026-08-13) — non-blocking, initials avatar renders meanwhile (D11)                                                                                     |
| Auth email texts                                       | Supabase dashboard                             | owner-handled by Roman (D14), non-blocking                                                                                                                                               |
| Marzahn-Hellersdorf Regelwerk (eigene Dokumentenliste) | `office_document_rule` (does not exist yet)    | BACKLOG — first real customer lives there (PLZ 12687); natural next office once Roman confirms demand. Until then his checklist is deliberately the fallback set + banner (Batch C, D-7) |
| Logo print-grade originals                             | `public/logo.svg` live (mini round 2026-08-13) | app-side ✅ RESOLVED; hi-res originals remain Roman's to send if ever needed (D16)                                                                                                       |

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
seit Juli) und der Ops-Hinweis zu Fall 52e364f1/Marzahn-Hellersdorf (Punkt 7).

## Mobile-Runde 3 (2026-08-27) — Burger-Menü, R10-Split, Foto-Platzhalter

**PLACEHOLDER_DE (offen)** — drei unsichtbare Screenreader-Labels des neuen
Burger-Menüs (`lib/strings/de.ts`, `case.menu.*`); nie sichtbar gemalt,
jedes Wort ist deins:

> **PLACEHOLDER_DE (Menü-Titel, nur Screenreader):** „Menü"
> **PLACEHOLDER_DE (Burger-Knopf):** „Menü öffnen"
> **PLACEHOLDER_DE (Schließen-Knopf):** „Schließen" — dasselbe Wort wie beim
> Hilfe-Fenster (dort bereits freigegeben), aber eine neue Stelle, darum pro
> forma hier.

**R10-Split (Gate-Antwort 3, KEIN Platzhalter — Provenienz-Notiz):** die
Zeile `docs.area_intro` trägt nach Migration `20260827000001` den vom
Gründer wörtlich vorgegebenen Satz („PDFs, Fotos und mehrere Dateien pro
Unterlage sind möglich. Vor der Einreichung prüfen wir alle Ihre
Unterlagen."). Dein bisheriger zweiter Satz („Erlaubt sind PDF, JPG, PNG
und HEIC bis 15 MB pro Datei.") bleibt zeichengenau erhalten, steht aber
jetzt in `de.ts` (`case.docs.typesLine`) als kleinere Zweitzeile — d. h.
er ist **nicht mehr per DB-Zeile editierbar**; eine Umformulierung wäre
eine Ein-Zeilen-Änderung in `de.ts`.

**Foto-Platzhalter (offen):** das Burger-Menü zeigt statt deines Fotos die
neutrale Silhouette `public/roman-placeholder.svg` (Markenfarben, bewusst
kein „falsches" Foto). Sobald dein echtes Foto da ist: Datei in `public/`
ablegen, eine Zeile im Menü (page.tsx) + optional `photoSrc` im
Hilfe-Fenster — beides vorbereitet.

**Für Roman zu klären (aus den Gate-Antworten, kein Copy-Item):**

1. **Zwei Telefonnummern, absichtlich (Gate-Antwort 4):** das Burger-Menü
   wählt `tel:+491789125300` (Vorgabe des Gründers, wörtlich); das
   Hilfe-Fenster zeigt weiter `contact.phone` = „0159 0469 5761". Welche
   Nummer soll überall gelten? Bis dahin bleiben beide.
2. **„sie ist der Antragsteller" (Gate-Antwort 2):** deine Zeile
   `case.patient_banner_body` bleibt UNVERÄNDERT bestehen. Der Gründer hat
   für Runde 3 eine Variante ohne „der" vorgegeben („… sie ist
   Antragsteller."); ob sie deine ersetzt, entscheidest du — wäre dann eine
   Ein-Zeilen-UPDATE-Migration.

## Bank-Docs-Pass (2026-08-29) — Abschluss-Texte: **AWAITING ROMAN** (nichts davon ist live)

Nach der letzten Antwort sagt die App heute sinngemäß „alle Fragen
beantwortet, wir prüfen" — der Gründer möchte deutlicher trennen: **Fragen
fertig ≠ Antrag fertig**, solange Unterlagen fehlen. Was bereits OHNE dich
umgesetzt wurde (C-1, keine neuen deutschen Texte): die Abschluss-Karten
zeigen jetzt zusätzlich deine bereits freigegebene Zähler-Zeile („Es fehlen
noch {n} Dokumente." / Einzahl-Variante) aus der Unterlagen-Seite.

Die folgenden DREI Zeilen sind **Vorschläge des Entwicklers — bewusst NICHT
live geschaltet** (Gate-Antwort 3: die prominenteste Stelle der App bekommt
keine Platzhalter). Jedes Wort ist deins: freigeben, umschreiben oder
verwerfen. Sobald du entscheidest, geht deine Fassung als eigene
Ein-Zeilen-Content-Migration live.

1. **NEU `case.all_answered_docs_message`** (Karte „alle Fragen
   beantwortet", NUR wenn Unterlagen fehlen — ersetzt dann die heutige
   Einheitsnachricht):

   > **VORSCHLAG (AWAITING ROMAN):** „Sie haben alle Fragen beantwortet.
   > Ihr Antrag ist damit noch nicht vollständig: Es fehlen noch
   > Unterlagen. Bitte laden Sie diese hoch — erst dann können wir alles
   > prüfen."

2. **UPDATE `case.all_answered_message`** (dieselbe Karte, dann NUR noch
   wenn KEINE Unterlagen fehlen — heutiger Text bittet auch dann um
   „fehlende Unterlagen"):

   > **Heute live:** „Sie haben alle Fragen beantwortet. Bitte laden Sie
   > noch fehlende Unterlagen hoch — danach prüfen wir Ihre Angaben."
   > **VORSCHLAG (AWAITING ROMAN):** „Sie haben alle Fragen beantwortet
   > und alle Unterlagen liegen vor. Wir prüfen jetzt Ihren Antrag und
   > melden uns bei Ihnen."

3. **UPDATE `case.locked_docs_heading`** (gesperrte Karte bei fehlenden
   Unterlagen — optionale Schärfung):

   > **Heute live:** „Es fehlen noch Unterlagen"
   > **VORSCHLAG (AWAITING ROMAN):** „Fragen beantwortet – Unterlagen
   > fehlen noch"
