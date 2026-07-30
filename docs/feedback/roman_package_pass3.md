# Paket für Roman — Feedback-Runde 3 (Stand 30.07.2026)

Hallo Roman,

hier ist das gesammelte Paket aus der dritten Feedback-Runde: zwei Erklärungen
zu Punkten, die sich als korrekt herausgestellt haben (§1, §2), drei Punkte,
bei denen wir **deine Entscheidung** brauchen (§3 Formulierungsregel, §4
Fragen-Reihenfolge, §5 Renten-Doppelabfrage), eine Info zur
Umlaut-Korrektur (§6) und die Erinnerungsliste der noch offenen Freigaben (§7).

---

## 1. PLZ 10961 (Kreuzberg) zeigt die „Pankow"-Dokumentenliste — warum das richtig ist

Deine Beobachtung: Ein Fall mit vorheriger PLZ 10961 (Berlin-Kreuzberg) bekommt
die Dokumentenliste, die wir für Pankow gebaut haben. Das ist **kein Fehler**,
sondern die eingebaute Standard-Logik:

- Für 10961 gibt es (noch) kein eigenes Sozialamt mit eigenen Dokumentregeln
  im System. Der Fall läuft deshalb über den **Berliner Fragebogen** und
  benutzt als Dokumentenliste den **konfigurierten Standard** — und der ist
  bewusst Pankow.
- Warum Pankow und nicht Essen? Die Dokumentregeln „lesen" die Antworten des
  Fragebogens. Die Pankow-Regeln sind auf die **Berliner Fragen** geschrieben
  (gleiche Fragen-Schlüssel, gleiche Antwortwerte). Die Essen-Regeln dagegen
  beziehen sich auf Fragen, die es **nur im Essener Fragebogen gibt** (z. B.
  die Ankreuz-Blöcke „Trifft eine dieser besonderen Situationen zu?"). Würden
  wir Essen als Standard nehmen, würden diese Regeln bei einem Berliner Fall
  **ins Leere greifen**: Ein Großteil der Bedingungen könnte nie zutreffen,
  und die Liste wäre lückenhaft und falsch.
- Kurz: **Standard-Liste = Pankow, weil Standard-Fragebogen = Berlin.** Beides
  gehört zusammen. Sobald ein Amt eigene Regeln bekommt (wie Essen sie jetzt
  hat), gewinnen automatisch die eigenen Regeln.

Wenn dich die Pankow-spezifischen Pflichtdokumente (z. B. Mobilitätsnachweis)
in solchen Fällen stören: Das ist die dokumentierte, bewusst akzeptierte
„Über-Erhebung" — lieber ein Dokument zu viel einsammeln als eines zu wenig.

## 2. „Der Upload-Link ist öffentlich sichtbar" — warum die Dateien trotzdem privat sind

Der Link, den du gesehen hast, ist eine **signierte Kurzzeit-URL**. So
funktioniert der Dateizugriff bei uns:

- Alle Dateien liegen in einem **privaten** Speicher-Bereich. Es gibt keine
  öffentliche Adresse; wer die „normale" URL einer Datei aufruft, bekommt
  einen Fehler (das haben wir im Sicherheits-Audit nachgewiesen).
- Klickt der **eingeloggte Eigentümer** eines Falls auf seine Datei, prüft der
  Server zuerst: Ist die Sitzung echt? Gehört die Datei zu genau diesem Fall?
  Erst dann erzeugt er eine einmalige Abruf-URL, die **nach 60 Sekunden
  verfällt**.
- Diese URL enthält eine kryptografische Signatur — sie sieht deshalb „kryptisch
  öffentlich" aus. Ja: Wer genau diesen Link innerhalb der 60 Sekunden hätte,
  könnte die Datei laden — genau dafür ist er da (der Browser braucht ihn zum
  Anzeigen). Danach ist er wertlos. Der Link wird nirgends gespeichert und
  taucht in keinem Protokoll auf.
- Zusätzlich gilt auf Speicher-Ebene: Jeder Nutzer kann nur Objekte seines
  eigenen Falls lesen, hochladen oder löschen (im Audit mit zwei echten Konten
  gegeneinander getestet, 50/50 bestanden).

Fazit: Verhalten wie vorgesehen; es gibt keinen öffentlichen Zugriff auf
Dokumente.

## 3. Frage-Perspektive („Sie" = wer eigentlich?) — wir brauchen deine Formulierungsregel

Dein Punkt 4 aus der Runde. Der Befund, mit Beispielen:

- Die Registrierung erfasst die **angehörige Person** (die das Formular
  ausfüllt). Der Fragebogen beginnt mit dem Hinweis: „Die folgenden Fragen
  beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt…"
- Danach mischen sich aber zwei Perspektiven:
  - Berlin, Frage 1: „**Vorname der pflegebedürftigen Person**" (3. Person) —
    direkt gefolgt von Frage 2: „Was ist **Ihr** Geburtsname?" (2. Person).
  - Essen fragt durchgehend in der 2. Person („Wie lautet **Ihr** Nachname?"),
    verlässt sich also komplett auf den Eingangshinweis.
  - Partnerfragen sagen „**Ihr** Partner" — gemeint ist der Partner der
    pflegebedürftigen Person, nicht der des Ausfüllenden.
- Risiko: Angehörige tragen versehentlich die **eigenen** Daten ein (Geburtsname,
  Geburtsort, Konten), besonders bei Fragen ohne den Zusatz „der
  pflegebedürftigen Person".

**Was wir von dir brauchen — eine einzige, konsequente Regel, z. B.:**

- **Option A:** durchgehend 2. Person („Sie" = die pflegebedürftige Person),
  Eingangshinweis bleibt, ggf. dauerhaft sichtbare Erinnerung. (= heutiger
  Essen-Stil; minimale Textänderungen in Berlin.)
- **Option B:** durchgehend 3. Person („…der pflegebedürftigen Person") —
  eindeutig, aber jede Frage wird länger und distanzierter; fast alle ~400
  Fragetexte beider Fragebögen müssten angefasst werden.
- **Option C:** Hybrid nach deiner Definition (z. B. 3. Person nur bei
  verwechslungsanfälligen Feldern wie Namen/Geburtsdaten/Konten).

Sobald deine Regel steht, formulieren wir die betroffenen Fragen als
Migrationsvorlage vor und du gibst die Texte frei. **In dieser Runde ändern
wir noch nichts.**

## 4. Fragen-Reihenfolge — Ist-Stand als Tabellen, deine Ziel-Reihenfolge bitte

Dein Punkt 6 („die Reihenfolge springt zwischen Themen"). Stimmt — die
markantesten Sprünge in Berlin:

1. Das Thema „frühere Wohnung" ist **dreigeteilt**: Straße/Stadt ganz vorne
   (Pos. 6–7), „seit wann in Berlin / Mietverhältnis" in der Mitte
   (Pos. 33–35), Vermieter/Miete/Kündigung erst danach im Abschnitt
   „Einnahmen und Rente" (Pos. 38–43).
2. **Rente wird zweimal erhoben** (siehe §5): einmal als Ja/Nein + Betrag
   (Pos. 36–37), einmal als Renten-Liste mit Details (Pos. 53–56) — mit den
   Mietfragen dazwischen.
3. Betreuung/Vollmacht (Pos. 21) steht mitten zwischen Sozialhilfe-Historie
   und Ausweisen.

Essen folgt durchgehend deiner Master-Datei und hat keine vergleichbaren
Sprünge.

**Was wir von dir brauchen:** die gewünschte **Ziel-Reihenfolge** (gern einfach
als umsortierte Nummernliste auf Basis der Tabellen unten, oder als grobe
Blöcke „erst X, dann Y"). Wir setzen sie dann als Migration um — die
Bedingungslogik prüfen wir dabei automatisch (eine Steuer-Frage muss vor ihren
abhängigen Fragen bleiben).

Die vollständigen Tabellen beider Fragebögen stehen als **Anhang am Ende
dieses Dokuments** (Berlin: 168 Fragen, Essen: 245 Fragen; Spalte „Sichtbar
nur wenn" zeigt die Abhängigkeit).

## 5. Renten-Doppelabfrage (Berlin) — Befund und Vorschlag

Dein Punkt 9. Wichtig vorweg, wie von dir bestätigt: **Der fertige Antrag
braucht die Rentenbeträge — es fällt nichts weg, was Beträge speichert.**

Befund (nur Berlin; Essen hat das Problem nicht):

- Berlin fragt **doppelt**: erst „Erhält die pflegebedürftige Person Rente?"
  (Ja/Nein) + „Monatlicher Rentenbetrag (€)" (ein Gesamtbetrag), später die
  Renten-Liste: pro Rente Art, **Betrag**, Abrechnungsnummer, Träger — mit der
  Option „Keine Rente".
- Die Ja/Nein-Frage steuert **nur** das eine Betragsfeld. Kein Dokument hängt
  daran, keine andere Frage, kein Export-Sonderfall. Die Dokument-Slots
  („Renten-/Pensionsbescheid pro Rente") entstehen ausschließlich aus der
  Renten-Liste.
- Der einzelne „Monatlicher Rentenbetrag" ist damit eine **redundante
  Zweitspeicherung** neben den Beträgen pro Rente — und kann sogar
  widersprechen (z. B. Summe der Listeneinträge ≠ Einzelfeld).

**Unser Vorschlag (noch nicht umgesetzt, deine Entscheidung):** Die beiden
Fragen aus Pos. 36–37 streichen. „Keine Rente" in der Renten-Liste übernimmt
das Nein; die Beträge pro Rente bleiben die (einzige, saubere) Quelle für den
Antrag. Nebenwirkung: Der Berliner Fragebogen wird zwei Pflichtfragen kürzer.
Zusätzlich verschwindet der Hinweistext „Bitte geben Sie den Bruttobetrag aus
dem aktuellen Rentenbescheid an." automatisch mit — unabhängig davon löschen
wir ihn auf deine Anweisung schon jetzt in dieser Runde (dein Punkt 7).

Zur Einordnung: Die Berliner Renten-Liste erfasst heute **einen** Betrag pro
Rente (netto, ohne Brutto/Netto-Unterscheidung); Essen erfasst pro Rente
Brutto **und** Netto. Falls der Berliner Antrag Brutto braucht, wäre das ein
separater kleiner Zusatz (eine Frage in der Renten-Liste) — sag uns Bescheid.

## 6. Umlaut-Korrektur der Dokumentnamen (zur Kenntnis) + drei „ss"-Fälle (deine Entscheidung)

Vier alte Dokumentnamen aus der Pankow-Erstbefüllung wurden ohne Umlaute
gespeichert und erscheinen so in der Checkliste. Wir korrigieren rein
mechanisch (ae→ä, oe→ö, ue→ü), keine Umformulierung:

| Dokument | heute                                        | wird zu                                     |
| -------- | -------------------------------------------- | ------------------------------------------- |
| DOC-0003 | Kontoauszuege                                | Kontoauszüge                                |
| DOC-0011 | Mobilitaetsnachweis                          | Mobilitätsnachweis                          |
| DOC-0021 | Heimatvertriebener/Spaetaussiedler Nachweis  | Heimatvertriebener/Spätaussiedler Nachweis  |
| DOC-0025 | Mietkuendigungsnachweis                      | Mietkündigungsnachweis                      |

**Deine Entscheidung (wir fassen „ss" grundsätzlich nicht automatisch an, weil
ss→ß nicht mechanisch sicher ist):**

| Dokument | Text                            | Unsere Einschätzung                          |
| -------- | ------------------------------- | -------------------------------------------- |
| DOC-0005 | Leistungsbescheid Pflege**kass**e | „Kasse" ist korrekt — bitte bestätigen     |
| DOC-0017 | Aufenthalt**ss**tatus           | Wortfuge (Aufenthalts-Status) — korrekt      |
| DOC-0021 | …Spaetau**ss**iedler…           | Wortfuge (Aus-Siedler) — korrekt             |

Kurze Bestätigung genügt („alle drei so lassen" / Abweichungen nennen).

## 7. Erinnerung: noch offene Freigaben aus früheren Runden

1. **Die 13 neuen Dokumentnamen** aus deiner Essen-Regeldatei (DOC-0031…0043,
   live in der Checkliste, wortgleich aus deiner Datei übernommen) — bitte
   einmal drüberschauen, ob alle so bleiben. Liste:
   `docs/document-rules/german_copy_for_roman.md`, Abschnitt 2.
2. **Hinweistext „Kontoauszüge der letzten 4 Monate"** (Platzhalter, noch
   nirgends eingebaut): „Bitte reichen Sie lückenlose Kontoauszüge der letzten
   4 Monate vor dem Antragsdatum ein (alle Konten)." — Freigabe oder deine
   Formulierung, dann bauen wir ihn in den Dokumentenbereich ein.
3. **Partner-Abschnitt (kosmetisch):** die Angleichung der Einleitungstexte
   der Partner-Ankreuzblöcke (E3) und die Frage, ob Berlin bei den
   Partner-Versicherungsbeiträgen die gleiche Detailtiefe wie Essen bekommen
   soll (freiwillig/privat-Staffelung).
4. **E-Mail-Texte (Anmeldebestätigung + beide Betreffzeilen):** am 23.07. per
   Gründerentscheid als final markiert (die Live-Texte laufen seit Wochen
   unbeanstandet). Nur zur Kenntnis — falls du doch etwas ändern willst, geht
   das jederzeit als normale Änderung.

---

# Anhang: vollständige Fragen-Reihenfolge (Ist-Stand, 30.07.2026)

### Berlin (30000000-…-0001) — aktuelle Reihenfolge

| # | Frage-Key | Frage (gekürzt) | Sektion | Gruppe | Pflicht | Sichtbar nur wenn |
|---|---|---|---|---|---|---|
| 1 | `first_name` | Vorname der pflegebedürftigen Person | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 2 | `birth_name` | Was ist Ihr Geburtsname? | antragsteller (Angaben zur pflegebedürftigen Person) | — | optional | — |
| 3 | `last_name` | Nachname der pflegebedürftigen Person | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 4 | `geburtsdatum` | Geburtsdatum der pflegebedürftigen Person | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 5 | `in_facility_since` | Wann sind Sie in das Pflegeheim eingezogen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 6 | `last_residence_street` | Wie lautete die Straße und Hausnummer Ihrer letzten Wohnung? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 7 | `last_residence_city` | In welcher Stadt lag Ihre letzte Wohnung? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 8 | `district_of_birth` | In welchem Kreis/Bezirk wurden Sie geboren? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 9 | `country_of_birth` | In welchem Land wurden Sie geboren? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 10 | `gender` | Was ist Ihr Geschlecht? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 11 | `marital_status` | Was ist Ihr Familienstand? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 12 | `marital_status_since` | Seit wann ist dies Ihr Familienstand? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 13 | `german_citizenship_yes_no` | Haben Sie die deutsche Staatsangehörigkeit? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 14 | `citizenship` | Was ist Ihre Staatsangehörigkeit? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | german_citizenship_yes_no = „Nein" |
| 15 | `issuer_of_id` | Welche Behörde hat Ihr Personaldokument ausgestellt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 16 | `id_expiry_date` | Bis wann ist Ihr Personaldokument gültig? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 17 | `prior_social_aid` | Haben Sie schon einmal Hilfe-zur-Pflege bekommen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 18 | `prior_social_aid_until` | Bis wann haben Sie Hilfe-zur-Pflege bekommen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | prior_social_aid = „Ja" |
| 19 | `prior_social_aid_issuer` | Welche Behörde hat die Hilfe-zur-Pflege bewilligt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | prior_social_aid = „Ja" |
| 20 | `prior_social_aid_reference_id` | Welches Aktenzeichen steht auf dem Bescheid? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | prior_social_aid = „Ja" |
| 21 | `power_of_attorney` | Haben Sie eine gesetzliche Betreuung oder eine bevollmächtig… | antragsteller (Angaben zur pflegebedürftigen Person) | — | optional | — |
| 22 | `special_origin_rights` | Haben Sie einen Vertriebenen- oder Spätaussiedlerausweis? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 23 | `special_origin_rights_issued` | Wann wurde der Ausweis ausgestellt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | special_origin_rights ≠ „Nein" |
| 24 | `special_origin_rights_issued_by` | Welche Behörde hat den Ausweis ausgestellt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | special_origin_rights ≠ „Nein" |
| 25 | `disability_card` | Haben Sie einen Schwerbehindertenausweis? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 26 | `disablity_card_application` | Haben Sie einen Schwerbehindertenausweis beantragt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Nein" |
| 27 | `disability_card_expiry` | Bis wann ist Ihr Schwerbehindertenausweis gültig? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Ja" |
| 28 | `disability_card_markers` | Welche Merkzeichen stehen in Ihrem Schwerbehindertenausweis? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Ja" |
| 29 | `health_insurance` | Bei welcher Krankenkasse sind Sie versichert? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 30 | `health_insurance_type` | Wie sind Sie krankenversichert? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 31 | `care_level` | Welchen Pflegegrad haben Sie? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 32 | `prior_social_service_applications` | Haben Sie weitere Sozialleistungen beantragt? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 33 | `berlin_since` | Seit wann haben Sie vor dem Einzug ins Pflegeheim in Ihrer l… | wohnsituation (Wohnsituation) | — | ja | — |
| 34 | `berlin_district_since` | Seit wann haben Sie vor dem Einzug ins Pflegeheim in diesem … | wohnsituation (Wohnsituation) | — | ja | — |
| 35 | `apartment_ownership` | Wie haben Sie vor dem Einzug ins Pflegeheim gewohnt? | wohnsituation (Wohnsituation) | — | ja | — |
| 36 | `hat_rente` | Erhält die pflegebedürftige Person Rente? | einkommen (Einnahmen und Rente) | — | ja | — |
| 37 | `rentenbetrag` | Monatlicher Rentenbetrag (€) | einkommen (Einnahmen und Rente) | — | ja | hat_rente = „Ja" |
| 38 | `landlord_name_and_address` | Wie heißen Ihr Vermieter und seine Adresse? | einkommen (Einnahmen und Rente) | — | ja | apartment_ownership = „Mietwohnung" |
| 39 | `rent_total` | Wie hoch war Ihre monatliche Miete? | einkommen (Einnahmen und Rente) | — | ja | apartment_ownership = „Mietwohnung" |
| 40 | `rent_paid_until` | Bis wann wurde die Miete schon bezahlt? | einkommen (Einnahmen und Rente) | — | ja | apartment_ownership = „Mietwohnung" |
| 41 | `rent_debt` | Wie hoch sind die Mietrückstände für Ihre letzte Wohnung? | einkommen (Einnahmen und Rente) | — | ja | apartment_ownership = „Mietwohnung" |
| 42 | `rent_contract_termination_yes_no` | Haben Sie Ihre letzte Wohnung bereits gekündigt? | einkommen (Einnahmen und Rente) | — | ja | apartment_ownership = „Mietwohnung" |
| 43 | `rent_contract_terminated_by` | Zu welchem Datum wurde Ihre letzte Wohnung gekündigt? | einkommen (Einnahmen und Rente) | — | ja | rent_contract_termination_yes_no = „Ja" |
| 44 | `children_yes_no` | Haben Sie Kinder? | kinder (Kinder) | — | ja | — |
| 45 | `child_first_name` | Wie lautet der Vorname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | children_yes_no = „Ja" |
| 46 | `child_last_name` | Wie lautet der Nachname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 47 | `child_birth_name` | Wie lautet der Geburtsname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 48 | `child_birth_date` | Wann wurde Ihr Kind geboren? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 49 | `child_marital_status` | Welchen Familienstand hat Ihr Kind? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 50 | `child_family_tie` | In welchem Verhältnis steht dieses Kind zu Ihnen? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 51 | `child_profession` | Welchen Beruf hat Ihr Kind? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 52 | `child_address` | Wie lautet die Wohnadresse Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 53 | `pension_type` | Welche Rente oder Pension bekommen Sie? | income (Einkünfte) | pension (wiederholbar) | ja | — |
| 54 | `pension_amount` | Wie hoch ist diese Rente oder Pension pro Monat? | income (Einkünfte) | pension (wiederholbar) | ja | pension_type ∈ [Erwerbsminderungsrente, Unfallrente, Altersrente, …] |
| 55 | `pension_id` | Welche Abrechnungsnummer hat diese Rente oder Pension? | income (Einkünfte) | pension (wiederholbar) | ja | pension_type ∈ [Erwerbsminderungsrente, Unfallrente, Altersrente, …] |
| 56 | `pension_issuer` | Von wem bekommen Sie diese Rente oder Pension? | income (Einkünfte) | pension (wiederholbar) | ja | pension_type ∈ [Erwerbsminderungsrente, Unfallrente, Altersrente, …] |
| 57 | `wohngeld_yes_no` | Beziehen Sie Wohngeld? | income (Einkünfte) | — | ja | — |
| 58 | `wohngeld_amount` | Wie viel Wohngeld bekommen Sie pro Monat? | income (Einkünfte) | — | ja | wohngeld_yes_no = „Ja" |
| 59 | `wohngeld_id` | Welches Aktenzeichen steht auf Ihrem Wohngeldbescheid? | income (Einkünfte) | — | ja | wohngeld_yes_no = „Ja" |
| 60 | `other_income` | Haben Sie weiteres Einkommen? | income (Einkünfte) | — | ja | — |
| 61 | `other_income_type` | Welche Art von weiterem Einkommen haben Sie? | income (Einkünfte) | other_income (wiederholbar) | ja | other_income = „Ja" |
| 62 | `other_income_amount` | Wie hoch ist dieses weitere Einkommen pro Monat? | income (Einkünfte) | other_income (wiederholbar) | ja | other_income = „Ja" |
| 63 | `govermental_employee` | Waren Sie früher Beamter? | expenditure (Ausgaben) | — | ja | — |
| 64 | `health_insurance_amount` | Wie hoch ist Ihr monatlicher Beitrag zur Krankenversicherung… | expenditure (Ausgaben) | — | ja | govermental_employee = „Ja" |
| 65 | `care_insurance_amount` | Wie hoch ist Ihr monatlicher Beitrag zur Pflegeversicherung? | expenditure (Ausgaben) | — | ja | govermental_employee = „Ja" |
| 66 | `general_liablity_insurance_yes_no` | Haben Sie eine Haftpflichtversicherung? | expenditure (Ausgaben) | — | ja | — |
| 67 | `general_liablity_insurance_provider` | Bei welcher Versicherung haben Sie Ihre Haftpflichtversicher… | expenditure (Ausgaben) | — | ja | general_liablity_insurance_yes_no = „Ja" |
| 68 | `general_liability_amount` | Wie hoch ist Ihr monatlicher Beitrag zur Haftpflichtversiche… | expenditure (Ausgaben) | — | ja | general_liablity_insurance_yes_no = „Ja" |
| 69 | `life_insurance` | Haben Sie eine Lebens- oder Sterbeversicherung? | expenditure (Ausgaben) | — | ja | — |
| 70 | `life_insurance_monthly_amount` | Wie hoch ist Ihr monatlicher Beitrag für diese Versicherung? | expenditure (Ausgaben) | — | ja | life_insurance ≠ „Nein" |
| 71 | `life_insurance_total_amount` | Wie viel würde diese Versicherung auszahlen? | expenditure (Ausgaben) | — | ja | life_insurance ≠ „Nein" |
| 72 | `life_insurance_name` | Bei welcher Versicherung haben Sie diese Versicherung? | expenditure (Ausgaben) | — | ja | life_insurance ≠ „Nein" |
| 73 | `life_insurance_number` | Wie lautet die Versicherungsnummer? | expenditure (Ausgaben) | — | ja | life_insurance ≠ „Nein" |
| 74 | `funeral_insurance_yes_no` | Haben Sie einen Bestattungsvorsorgevertrag? | wealth (Vermögen) | — | ja | — |
| 75 | `funeral_insurance_amount` | Wie viel würde der Bestattungsvorsorgevertrag auszahlen? | wealth (Vermögen) | — | ja | funeral_insurance_yes_no = „Ja" |
| 76 | `funeral_insurance_detail` | Was trifft auf Ihren Bestattungsvorsorgevertrag zu? | wealth (Vermögen) | — | ja | funeral_insurance_yes_no = „Ja" |
| 77 | `bank_giro` | Bei welcher Bank haben Sie Ihr Girokonto? | wealth (Vermögen) | — | ja | — |
| 78 | `bank_giro_blz` | Wie lautet die Bankleitzahl Ihrer Bank? | wealth (Vermögen) | — | ja | — |
| 79 | `bank_giro_iban` | Wie lautet die IBAN Ihres Girokontos? | wealth (Vermögen) | — | ja | — |
| 80 | `bank_giro_amount` | Wie hoch ist der Betrag auf Ihrem Girokonto? | wealth (Vermögen) | — | ja | — |
| 81 | `bank_savings_account_yes_no` | Haben Sie ein Sparkonto? | wealth (Vermögen) | — | ja | — |
| 82 | `bank_savings_account_amount` | Wie viel Geld ist auf Ihrem Sparkonto? | wealth (Vermögen) | — | ja | bank_savings_account_yes_no = „Ja" |
| 83 | `bank_savings_iban` | Wie lautet die IBAN Ihres Sparkontos? | wealth (Vermögen) | — | ja | bank_savings_account_yes_no = „Ja" |
| 84 | `bank_additional_account_yes_no` | Haben Sie noch ein weiteres Konto? | wealth (Vermögen) | — | ja | — |
| 85 | `bank_additional_name` | Bei welcher Bank ist dieses weitere Konto? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 86 | `bank_additional_iban` | Wie lautet die IBAN dieses Kontos? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 87 | `bank_additional_amount` | Wie viel Geld ist auf diesem Konto? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 88 | `cash_savings` | Wie viel Bargeld haben Sie? | wealth (Vermögen) | — | ja | — |
| 89 | `automobile_owner` | Haben Sie ein Auto? | wealth (Vermögen) | — | ja | — |
| 90 | `automobile_numbers_plate` | Welches Kennzeichen hat Ihr Auto? | wealth (Vermögen) | — | ja | automobile_owner = „Ja" |
| 91 | `automobile_type` | Welches Modell ist Ihr Auto? | wealth (Vermögen) | — | ja | automobile_owner = „Ja" |
| 92 | `automobile_year` | Aus welchem Baujahr ist Ihr Auto? | wealth (Vermögen) | — | ja | automobile_owner = „Ja" |
| 93 | `automobile_holder` | Wer ist als Fahrzeughalter eingetragen? | wealth (Vermögen) | — | ja | automobile_owner = „Ja" |
| 94 | `property_yes_no` | Haben Sie ein Haus, eine Wohnung oder ein Grundstück? | wealth (Vermögen) | — | ja | — |
| 95 | `property_address` | Wie lautet die Adresse der Immobilie? | wealth (Vermögen) | — | ja | property_yes_no ≠ „Nein" |
| 96 | `property_usage` | Wie nutzen Sie die Immobilie? | wealth (Vermögen) | — | ja | property_yes_no ≠ „Nein" |
| 97 | `property_size` | Wie groß ist die Immobilie in Quadratmetern? | wealth (Vermögen) | — | ja | property_yes_no ≠ „Nein" |
| 98 | `additional_wealth_yes_no` | Haben Sie weitere Vermögenswerte? | wealth (Vermögen) | — | ja | — |
| 99 | `additional_wealth_type` | Welche weiteren Vermögenswerte haben Sie? | wealth (Vermögen) | additional_wealth (wiederholbar) | ja | additional_wealth_yes_no = „Ja" |
| 100 | `additional_wealth_amount` | Wie viel ist dieser Vermögenswert ungefähr wert? | wealth (Vermögen) | additional_wealth (wiederholbar) | ja | additional_wealth_yes_no = „Ja" |
| 101 | `costly_diet` | Brauchen Sie aus medizinischen Gründen eine besondere Ernähr… | additional (Weitere Angaben) | — | ja | — |
| 102 | `spouse_last_name` | Wie lautet der Nachname Ihres Ehepartners oder Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 103 | `spouse_birth_name` | Wie lautet der Geburtsname Ihres Ehepartners oder Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 104 | `spouse_first_name` | Wie lautet der Vorname Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 105 | `spouse_birthdate` | Wann wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 106 | `spouse_city_of_birth` | In welcher Stadt wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 107 | `spouse_district_of_birth` | In welchem Kreis oder Bezirk wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 108 | `spouse_country_of_birth` | In welchem Land wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 109 | `spouse_gender` | Welches Geschlecht hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 110 | `spouse_german_citizenship_yes_no` | Hat Ihr Partner die deutsche Staatsangehörigkeit? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 111 | `spouse_citizenship` | Welche Staatsangehörigkeit hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_german_citizenship_yes_no = „Nein" |
| 112 | `spouse_issuer_of_id` | Welche Behörde hat das Personaldokument Ihres Partners ausge… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 113 | `spouse_id_expiry_date` | Bis wann ist das Personaldokument Ihres Partners gültig? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 114 | `spouse_prior_social_aid` | Hat Ihr Partner schon einmal Hilfe-zur-Pflege bekommen? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 115 | `spouse_prior_social_aid_until` | Bis wann hat Ihr Partner Hilfe-zur-Pflege bekommen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_prior_social_aid = „Ja" |
| 116 | `spouse_prior_social_aid_issuer` | Welche Behörde hat die Hilfe-zur-Pflege bewilligt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_prior_social_aid = „Ja" |
| 117 | `spouse_prior_social_aid_reference_id` | Welches Aktenzeichen steht auf dem Bescheid? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_prior_social_aid = „Ja" |
| 118 | `spouse_power_of_attorney` | Hat Ihr Partner eine gesetzliche Betreuung oder eine bevollm… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 119 | `spouse_special_origin_rights` | Hat Ihr Partner einen Vertriebenen- oder Spätaussiedlerauswe… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 120 | `spouse_special_origin_rights_issued` | Wann wurde der Ausweis ausgestellt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_special_origin_rights ≠ „Nein" |
| 121 | `spouse_special_origin_rights_issued_by` | Welche Behörde hat den Ausweis ausgestellt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_special_origin_rights ≠ „Nein" |
| 122 | `spouse_disability_card` | Hat Ihr Partner einen Schwerbehindertenausweis? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 123 | `spouse_disability_card_application` | Hat Ihr Partner einen Schwerbehindertenausweis beantragt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Nein" |
| 124 | `spouse_disability_card_expiry` | Bis wann ist der Schwerbehindertenausweis Ihres Partners gül… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Ja" |
| 125 | `spouse_disability_card_markers` | Welche Merkzeichen stehen im Schwerbehindertenausweis Ihres … | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Ja" |
| 126 | `spouse_health_insurance` | Bei welcher Krankenkasse ist Ihr Partner versichert? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 127 | `spouse_health_insurance_type` | Wie ist Ihr Partner krankenversichert? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 128 | `spouse_care_level` | Welchen Pflegegrad hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 129 | `spouse_in_facility_yes_no` | Wohnt Ihr Partner in einem Pflegeheim? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 130 | `spouse_in_facility_since` | Wann ist Ihr Partner in das Pflegeheim eingezogen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_in_facility_yes_no = „Ja" |
| 131 | `spouse_prior_social_service_applications` | Hat Ihr Partner weitere Sozialleistungen beantragt? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 132 | `spouse_pension_type` | Welche Rente oder Pension bekommt Ihr Partner? | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 133 | `spouse_pension_amount` | Wie hoch ist diese Rente oder Pension pro Monat? | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | spouse_pension_type beantwortet |
| 134 | `spouse_pension_id` | Welche Abrechnungsnummer hat diese Rente oder Pension? | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | spouse_pension_type beantwortet |
| 135 | `spouse_pension_issuer` | Von wem bekommt Ihr Partner diese Rente oder Pension? | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | spouse_pension_type beantwortet |
| 136 | `spouse_wohngeld_yes_no` | Bekommt Ihr Partner Wohngeld? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 137 | `spouse_wohngeld_amount` | Wie viel Wohngeld bekommt Ihr Partner pro Monat? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wohngeld_yes_no = „Ja" |
| 138 | `spouse_wohngeld_id` | Welches Aktenzeichen steht auf dem Wohngeldbescheid? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wohngeld_yes_no = „Ja" |
| 139 | `spouse_other_income` | Hat Ihr Partner weiteres Einkommen? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 140 | `spouse_other_income_type` | Welche Art von weiterem Einkommen hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | spouse_other_income (wiederholbar) | ja | spouse_other_income = „Ja" |
| 141 | `spouse_other_income_amount` | Wie hoch ist dieses weitere Einkommen pro Monat? | spouse (Ehepartner / Lebenspartner) | spouse_other_income (wiederholbar) | ja | spouse_other_income = „Ja" |
| 142 | `spouse_health_insurance_amount` | Wie hoch ist der monatliche Beitrag zur Krankenversicherung … | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 143 | `spouse_care_insurance_amount` | Wie hoch ist der monatliche Beitrag zur Pflegeversicherung I… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 144 | `spouse_general_liablity_insurance_yes_no` | Hat Ihr Partner eine Haftpflichtversicherung? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 145 | `spouse_general_liablity_insurance_provider` | Bei welcher Versicherung hat Ihr Partner die Haftpflichtvers… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_general_liablity_insurance_yes_no = „Ja" |
| 146 | `spouse_general_liability_amount` | Wie hoch ist der monatliche Beitrag zur Haftpflichtversicher… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_general_liablity_insurance_yes_no = „Ja" |
| 147 | `spouse_life_insurance` | Hat Ihr Partner eine Lebens- oder Sterbeversicherung? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 148 | `spouse_life_insurance_amount` | Wie hoch ist der monatliche Beitrag für diese Versicherung? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_life_insurance ≠ „Nein" |
| 149 | `spouse_bank_giro` | Bei welcher Bank hat Ihr Partner ein Girokonto? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 150 | `spouse_bank_giro_blz` | Wie lautet die Bankleitzahl der Bank Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 151 | `spouse_bank_giro_iban` | Wie lautet die IBAN des Girokontos Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 152 | `spouse_bank_account_amount` | Wie viel Geld ist auf dem Girokonto Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 153 | `spouse_bank_savings_account_yes_no` | Hat Ihr Partner ein Sparkonto? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 154 | `spouse_bank_savings_account_amount` | Wie viel Geld ist auf dem Sparkonto Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_bank_savings_account_yes_no = „Ja" |
| 155 | `spouse_bank_savings_iban` | Wie lautet die IBAN des Sparkontos Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_bank_savings_account_yes_no = „Ja" |
| 156 | `spouse_bank_additional_account_yes_no` | Hat Ihr Partner noch ein weiteres Konto? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 157 | `spouse_bank_additional_name` | Bei welcher Bank ist dieses weitere Konto? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 158 | `spouse_bank_additional_iban` | Wie lautet die IBAN dieses Kontos? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 159 | `spouse_bank_additional_amount` | Wie viel Geld ist auf diesem Konto? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 160 | `spouse_automobile_owner` | Hat Ihr Partner ein Auto? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 161 | `spouse_automobile_numbers_plate` | Welches Kennzeichen hat das Auto? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_owner = „Ja" |
| 162 | `spouse_automobile_type` | Welches Modell ist das Auto? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_owner = „Ja" |
| 163 | `spouse_automobile_year` | Aus welchem Baujahr ist das Auto? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_owner = „Ja" |
| 164 | `spouse_automobile_holder` | Wer ist als Fahrzeughalter eingetragen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_owner = „Ja" |
| 165 | `spouse_property_yes_no` | Hat Ihr Partner ein Haus, eine Wohnung oder ein Grundstück? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 166 | `spouse_additional_wealth_yes_no` | Hat Ihr Partner weitere Vermögenswerte? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 167 | `spouse_additional_wealth_type` | Welche weiteren Vermögenswerte hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_additional_wealth_yes_no = „Ja" |
| 168 | `spouse_additional_wealth_amount` | Wie viel ist dieser Vermögenswert ungefähr wert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_additional_wealth_yes_no = „Ja" |

### Essen (30000000-…-0003) — aktuelle Reihenfolge

| # | Frage-Key | Frage (gekürzt) | Sektion | Gruppe | Pflicht | Sichtbar nur wenn |
|---|---|---|---|---|---|---|
| 1 | `last_name` | Wie lautet Ihr Nachname? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 2 | `first_name` | Wie lautet Ihr Vorname? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 3 | `birth_name` | Wie lautet Ihr Geburtsname? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 4 | `birthdate` | Wann wurden Sie geboren? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 5 | `gender` | Was ist Ihr Geschlecht? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 6 | `city_of_birth` | In welchem Ort wurden Sie geboren? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 7 | `tax_id` | Wie lautet Ihre Steuer-ID? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 8 | `pension_insurance_number` | Wie lautet Ihre Rentenversicherungsnummer? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 9 | `marital_status` | Was ist Ihr Familienstand? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 10 | `marital_status_since` | Seit wann ist dies Ihr Familienstand? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 11 | `citizenship` | Welche Staatsangehörigkeit haben Sie? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 12 | `residence_status` | Welchen Aufenthaltsstatus haben Sie? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 13 | `entry_to_germany_date` | Wann sind Sie nach Deutschland eingereist? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | residence_status ≠ „Nicht zutreffend/deutsch" |
| 14 | `residence_status_other` | Welchen sonstigen Aufenthaltsstatus haben Sie? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | residence_status = „Sonstiger Status" |
| 15 | `legal_guardian_yes_no` | Haben Sie eine gesetzliche Betreuung oder eine bevollmächtig… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 16 | `legal_guardian_name_address` | Wie heißt Ihre Betreuung oder bevollmächtigte Person, und wi… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | legal_guardian_yes_no = „Ja" |
| 17 | `disability_card` | Haben Sie einen Schwerbehindertenausweis oder Feststellungsb… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 18 | `disability_card_expiry` | Bis wann ist Ihr Schwerbehindertenausweis oder Feststellungs… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Ja" |
| 19 | `disability_card_application_date` | Wann haben Sie den Schwerbehindertenausweis oder Feststellun… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Beantragt" |
| 20 | `disability_card_markers` | Welche Merkzeichen stehen in Ihrem Schwerbehindertenausweis? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | disability_card = „Ja" |
| 21 | `applicant_bulk_topics` | Trifft eine dieser seltenen Situationen auf Sie zu? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | — |
| 22 | `commitment_declaration_date` | Wann hat jemand bei der Ausländerbehörde unterschrieben, fin… | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | applicant_bulk_topics enthält „Es besteht eine Verpflichtungserklaerung…" |
| 23 | `prior_sgb_benefits_provider` | Von welcher Stelle haben Sie diese Leistungen bekommen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 24 | `prior_sgb_benefits_from` | Seit wann haben Sie diese Leistungen bekommen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 25 | `prior_sgb_benefits_until` | Bis wann haben Sie diese Leistungen bekommen? | antragsteller (Angaben zur pflegebedürftigen Person) | — | ja | applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 26 | `last_residence_street` | In welcher Straße lag Ihre letzte Wohnung? | wohnsituation (Wohnsituation) | — | ja | — |
| 27 | `last_residence_house_number` | Wie lautete die Hausnummer Ihrer letzten Wohnung? | wohnsituation (Wohnsituation) | — | ja | — |
| 28 | `last_residence_city` | In welchem Ort lag Ihre letzte Wohnung? | wohnsituation (Wohnsituation) | — | ja | — |
| 29 | `former_rental_apartment_yes_no` | Hatten Sie vor dem Einzug ins Pflegeheim eine Mietwohnung? | wohnsituation (Wohnsituation) | — | ja | — |
| 30 | `former_rent_contract_active_yes_no` | Läuft der Mietvertrag Ihrer letzten Wohnung noch? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 31 | `former_rent_amount_warm` | Wie hoch ist die monatliche Warmmiete der letzten Wohnung? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 32 | `former_rent_paid_until` | Bis wann wurde die Miete für Ihre letzte Wohnung bezahlt? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 33 | `former_rent_contract_termination_yes_no` | Haben Sie Ihre letzte Wohnung bereits gekündigt? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 34 | `former_rent_contract_terminated_by` | Zu welchem Datum wurde Ihre letzte Wohnung gekündigt? | wohnsituation (Wohnsituation) | — | ja | former_rent_contract_termination_yes_no = „Ja" |
| 35 | `former_rent_debt` | Wie hoch sind die Mietrückstände für die letzte Wohnung? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 36 | `former_landlord_name_address` | Wie heißen Ihr Vermieter und seine Adresse? | wohnsituation (Wohnsituation) | — | ja | former_rental_apartment_yes_no = „Ja" |
| 37 | `children_yes_no` | Haben Sie Kinder? | kinder (Kinder) | — | ja | — |
| 38 | `child_first_name` | Wie lautet der Vorname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | children_yes_no = „Ja" |
| 39 | `child_last_name` | Wie lautet der Nachname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 40 | `child_birth_name` | Wie lautet der Geburtsname Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 41 | `child_birth_date` | Wann wurde Ihr Kind geboren? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 42 | `child_marital_status` | Welchen Familienstand hat Ihr Kind? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 43 | `child_family_tie` | In welchem Verhältnis steht dieses Kind zu Ihnen? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 44 | `child_profession` | Welchen Beruf hat Ihr Kind? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 45 | `child_address` | Wie lautet die Wohnadresse Ihres Kindes? | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 46 | `child_high_income_100k_yes_no` | Glauben Sie, dass dieses Kind 100.000 Euro oder mehr im Jahr… | kinder (Kinder) | children (wiederholbar) | ja | child_first_name beantwortet |
| 47 | `maintenance_claims_status` | Bestehen Unterhaltsansprüche gegenüber ex Partner? | kinder (Kinder) | — | ja | — |
| 48 | `ex_partner_first_name` | Wie lautet der Vorname Ihres getrennt lebenden oder geschied… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 49 | `ex_partner_last_name` | Wie lautet der Nachname Ihres getrennt lebenden oder geschie… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 50 | `ex_partner_street` | In welcher Straße wohnt Ihr getrennt lebender oder geschiede… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 51 | `ex_partner_house_number` | Wie lautet die Hausnummer Ihres getrennt lebenden oder gesch… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 52 | `ex_partner_plz` | Wie lautet die Postleitzahl Ihres getrennt lebenden oder ges… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 53 | `ex_partner_city` | In welchem Ort wohnt Ihr getrennt lebender oder geschiedener… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 54 | `ex_partner_birthdate` | Wann wurde Ihr getrennt lebender oder geschiedener Partner g… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 55 | `ex_partner_city_of_birth` | In welchem Ort wurde Ihr getrennt lebender oder geschiedener… | kinder (Kinder) | — | ja | maintenance_claims_status ∈ [Auf Unterhalt wurde verzichtet, Unterhalt wird bereits bezahlt, Unterhalt wurde noch nicht geltend gemacht, …] |
| 56 | `health_insurance_yes_no` | Sind Sie aktuell krankenversichert? | income (Einkünfte) | — | ja | — |
| 57 | `health_insurance` | Bei welcher Krankenkasse sind Sie versichert? | income (Einkünfte) | — | ja | health_insurance_yes_no = „Ja" |
| 58 | `health_insurance_member_since` | Wie lange sind Sie schon Mitglied dieser Krankenversicherung… | income (Einkünfte) | — | ja | health_insurance_yes_no = „Ja" |
| 59 | `health_insurance_type` | Wie sind Sie kranken- und pflegeversichert? | income (Einkünfte) | — | ja | health_insurance_yes_no = „Ja" |
| 60 | `health_insurance_member_id` | Wie lautet Ihre Krankenversicherungsnummer? | income (Einkünfte) | — | ja | health_insurance_yes_no = „Ja" |
| 61 | `health_insurance_amount` | Wie hoch ist Ihr monatlicher Beitrag zur Krankenversicherung… | income (Einkünfte) | — | ja | health_insurance_type ∈ [freiwillige Versicherung, private Versicherung] |
| 62 | `care_insurance_amount` | Wie hoch ist Ihr monatlicher Beitrag zur Pflegeversicherung? | income (Einkünfte) | — | ja | health_insurance_type ∈ [freiwillige Versicherung, private Versicherung] |
| 63 | `foreign_health_insurance_yes_no` | Haben Sie eine ausländische Krankenversicherung? | income (Einkünfte) | — | ja | — |
| 64 | `foreign_health_insurance_name_address` | Wie heißen die ausländische Krankenversicherung und ihre Adr… | income (Einkünfte) | — | ja | foreign_health_insurance_yes_no = „Ja" |
| 65 | `last_health_insurance` | Bei welcher Krankenkasse waren Sie zuletzt versichert? | income (Einkünfte) | — | ja | health_insurance_yes_no = „Nein" |
| 66 | `last_health_insurance_from` | Ab wann waren Sie dort versichert? | income (Einkünfte) | — | ja | last_health_insurance beantwortet |
| 67 | `last_health_insurance_until` | Bis wann waren Sie dort versichert? | income (Einkünfte) | — | ja | last_health_insurance beantwortet |
| 68 | `pension_type` | Welche Rente oder Pension bekommen Sie? | income (Einkünfte) | pension (wiederholbar) | ja | — |
| 69 | `pension_amount_gross` | Wie hoch ist der Bruttobetrag dieser Rente oder Pension pro … | income (Einkünfte) | pension (wiederholbar) | ja | pension_type ∈ [Erwerbsminderungsrente, Altersrente, Unfallrente, …] |
| 70 | `pension_amount` | Wie hoch ist der Nettobetrag dieser Rente oder Pension pro M… | income (Einkünfte) | pension (wiederholbar) | ja | pension_type ∈ [Erwerbsminderungsrente, Altersrente, Unfallrente, …] |
| 71 | `pension_application_yes_no` | Haben Sie eine Rente beantragt, über die noch nicht entschie… | income (Einkünfte) | — | ja | — |
| 72 | `pension_application_date` | Wann haben Sie die Rente beantragt? | income (Einkünfte) | — | ja | pension_application_yes_no = „Ja" |
| 73 | `pension_application_issuer` | Bei welcher Stelle haben Sie die Rente beantragt? | income (Einkünfte) | — | ja | pension_application_yes_no = „Ja" |
| 74 | `pension_application_insurance_number` | Welche Versicherungsnummer gehört zu diesem Rentenantrag? | income (Einkünfte) | — | ja | pension_application_yes_no = „Ja" |
| 75 | `pension_application_type` | Welche Rente haben Sie beantragt? | income (Einkünfte) | — | ja | pension_application_yes_no = „Ja" |
| 76 | `other_income` | Haben Sie weiteres Einkommen? | income (Einkünfte) | — | ja | — |
| 77 | `other_income_type` | Welche Art von weiterem Einkommen haben Sie? | income (Einkünfte) | other_income (wiederholbar) | ja | other_income = „Ja" |
| 78 | `other_income_amount` | Wie hoch ist dieses Einkommen monatlich? | income (Einkünfte) | other_income (wiederholbar) | ja | other_income_type beantwortet |
| 79 | `income_bulk_topics` | Trifft eine dieser besonderen Einkommens- oder Rentensituati… | income (Einkünfte) | — | ja | — |
| 80 | `oeg_application_date` | Wann haben Sie den Antrag nach dem Opferentschädigungsgesetz… | income (Einkünfte) | — | ja | income_bulk_topics enthält „Es wurde ein Antrag nach dem Opferentsch…" |
| 81 | `oeg_application_issuer` | Bei welcher Stelle haben Sie den Antrag nach dem Opferentsch… | income (Einkünfte) | — | ja | income_bulk_topics enthält „Es wurde ein Antrag nach dem Opferentsch…" |
| 82 | `foreign_pension_contributions_details` | In welchem Land und in welchem Zeitraum wurden ausländische … | income (Einkünfte) | — | ja | income_bulk_topics enthält „Es wurde im Ausland gearbeitet und dort …" |
| 83 | `foreign_work_without_pension_contributions_details` | Wann und wo haben Sie im Ausland gearbeitet, ohne Rentenbeit… | income (Einkünfte) | — | ja | income_bulk_topics enthält „Es wurde im Ausland gearbeitet, ohne dor…" |
| 84 | `expense_bulk_topics` | Haben Sie eine dieser Ausgaben? | expenditure (Ausgaben) | — | ja | — |
| 85 | `income_tax_amount` | Wie hoch ist die monatliche Einkommensteuer? | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es werden Einkommensteuern gezahlt" |
| 86 | `social_security_contributions_amount` | Wie hoch sind Ihre monatlichen Sozialversicherungsbeiträge? | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es werden Sozialversicherungsbeitraege g…" |
| 87 | `general_liability_insurance_amount` | Wie hoch ist der monatliche Beitrag der Haftpflichtversicher… | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es besteht eine Haftpflichtversicherung" |
| 88 | `kfz_liability_insurance_amount` | Wie hoch ist der monatliche Beitrag der Kfz-Haftpflichtversi… | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es besteht eine Kfz-Haftpflichtversicher…" |
| 89 | `pension_contributions_amount` | Wie hoch sind die monatlichen Altersvorsorgebeiträge? | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es werden Altersvorsorgebeitraege gezahl…" |
| 90 | `funeral_insurance_contribution_amount` | Wie hoch ist der monatliche Beitrag der Sterbegeldversicheru… | expenditure (Ausgaben) | — | ja | expense_bulk_topics enthält „Es werden Beitraege zu einer Sterbegeldv…" |
| 91 | `cash_savings_amount` | Wie viel Bargeld haben Sie? | wealth (Vermögen) | — | ja | — |
| 92 | `bank_giro_yes_no` | Haben Sie Bankguthaben? | wealth (Vermögen) | — | ja | — |
| 93 | `bank_giro_amount` | Wie hoch ist Ihr Bankguthaben? | wealth (Vermögen) | — | ja | bank_giro_yes_no = „Ja" |
| 94 | `bank_savings_account_yes_no` | Haben Sie Sparguthaben? | wealth (Vermögen) | — | ja | — |
| 95 | `bank_savings_account_amount` | Wie hoch ist Ihr Sparguthaben? | wealth (Vermögen) | — | ja | bank_savings_account_yes_no = „Ja" |
| 96 | `bank_additional_account_yes_no` | Haben Sie sonstige Kontoguthaben, z. B. PayPal? | wealth (Vermögen) | — | ja | — |
| 97 | `bank_additional_name` | Bei welcher Bank haben Sie ein weiteres Konto? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 98 | `bank_additional_iban` | Was ist die IBAN Nummer dieses Kontos? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 99 | `bank_additional_bic` | Wie lautet die BIC? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 100 | `bank_additional_account_amount` | Wie hoch sind Ihre sonstigen Kontoguthaben? | wealth (Vermögen) | bank_additional (wiederholbar) | ja | bank_additional_account_yes_no = „Ja" |
| 101 | `funeral_insurance_yes_no` | Haben Sie einen Bestattungsvorsorgevertrag? | wealth (Vermögen) | — | ja | — |
| 102 | `funeral_insurance_amount` | Wie hoch ist der Betrag des Bestattungsvorsorgevertrags? | wealth (Vermögen) | — | ja | funeral_insurance_yes_no = „Ja" |
| 103 | `life_insurance` | Haben Sie eine Kapital- oder Risikolebensversicherung? | wealth (Vermögen) | — | ja | — |
| 104 | `life_insurance_total_amount` | Wie hoch ist der Betrag der Lebensversicherung? | wealth (Vermögen) | — | ja | life_insurance ≠ „Nein" |
| 105 | `life_insurance_surrender_value` | Wie hoch ist der aktuelle Rückkaufswert der Lebensversicheru… | wealth (Vermögen) | — | ja | life_insurance ≠ „Nein" |
| 106 | `automobile_yes_no` | Haben Sie ein Kraftfahrzeug? | wealth (Vermögen) | — | ja | — |
| 107 | `automobile_numbers_plate` | Welches amtliche Kennzeichen hat das Kraftfahrzeug? | wealth (Vermögen) | — | ja | automobile_yes_no = „Ja" |
| 108 | `automobile_year` | Aus welchem Baujahr ist das Kraftfahrzeug? | wealth (Vermögen) | — | ja | automobile_yes_no = „Ja" |
| 109 | `automobile_type` | Welches Fahrzeugmodell ist es? | wealth (Vermögen) | — | ja | automobile_yes_no = „Ja" |
| 110 | `automobile_vehicle_type` | Welches ist der Fahrzeugtyp? | wealth (Vermögen) | — | ja | automobile_yes_no = „Ja" |
| 111 | `automobile_mileage` | Wie hoch ist der Kilometerstand des Kraftfahrzeugs? | wealth (Vermögen) | — | ja | automobile_yes_no = „Ja" |
| 112 | `property_yes_no` | Besitzen Sie Haus- oder Wohneigentum? | wealth (Vermögen) | — | ja | — |
| 113 | `property_notes` | Bitte geben Sie Adresse, Art und Nutzung Ihres Haus- oder Wo… | wealth (Vermögen) | — | ja | property_yes_no = „Ja" |
| 114 | `additional_property_yes_no` | Besitzen Sie sonstigen Grundbesitz? | wealth (Vermögen) | — | ja | — |
| 115 | `additional_property_notes` | Bitte geben Sie Adresse, Art und Nutzung Ihres sonstigen Gru… | wealth (Vermögen) | — | ja | additional_property_yes_no = „Ja" |
| 116 | `asset_transfer_yes_no` | Haben Sie in den letzten 10 Jahren Vermögen an andere Person… | wealth (Vermögen) | — | ja | — |
| 117 | `asset_transfer_date` | Wann wurde das Vermögen übertragen? | wealth (Vermögen) | — | ja | asset_transfer_yes_no ∈ [Ja - ohne besonderen Vertrag, Ja - siehe beigefuegte Urkunde] |
| 118 | `asset_transfer_amount` | In welcher Höhe wurde Vermögen übertragen? | wealth (Vermögen) | — | ja | asset_transfer_yes_no ∈ [Ja - ohne besonderen Vertrag, Ja - siehe beigefuegte Urkunde] |
| 119 | `wealth_bulk_topics` | Haben Sie eine dieser besonderen Vermögensarten? | wealth (Vermögen) | — | ja | — |
| 120 | `securities_amount` | Welchen Wert haben Ihre Wertpapiere oder Aktien? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Wertpapiere oder Aktien" |
| 121 | `jewelry_metals_amount` | Welchen Wert haben Ihr Schmuck oder Ihre Edelmetalle? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Schmuck oder Edelmetalle von rel…" |
| 122 | `additional_wealth_amount` | Welchen Wert hat Ihr sonstiges Vermögen? | wealth (Vermögen) | additional_wealth (wiederholbar) | ja | wealth_bulk_topics enthält „Es gibt sonstiges Vermoegen im In- oder …" |
| 123 | `additional_wealth_type` | Welche Art von sonstigem Vermögen haben Sie? | wealth (Vermögen) | additional_wealth (wiederholbar) | ja | wealth_bulk_topics enthält „Es gibt sonstiges Vermoegen im In- oder …" |
| 124 | `state_subsidized_private_pension_amount` | Wie hoch ist der Betrag Ihrer staatlich geförderten privaten… | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt eine staatlich gefoerderte priva…" |
| 125 | `state_subsidized_private_pension_due_date` | Wann ist dieser Betrag fällig? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt eine staatlich gefoerderte priva…" |
| 126 | `private_pension_amount` | Wie hoch ist der Betrag Ihrer sonstigen privaten Altersvorso… | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt eine sonstige private Altersvors…" |
| 127 | `private_pension_due_date` | Wann ist dieser Betrag fällig? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt eine sonstige private Altersvors…" |
| 128 | `claims_against_third_parties_type` | Um welche Forderung oder welchen Anspruch handelt es sich? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Forderungen oder Ansprueche gege…" |
| 129 | `claims_against_third_parties_amount` | Wie hoch ist die Forderung oder der Anspruch? | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Forderungen oder Ansprueche gege…" |
| 130 | `transfer_contract_claims_notes` | Haben Sie durch einen Vertrag noch Rechte an einem Haus, ein… | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Ansprueche aus Uebertragsvertrae…" |
| 131 | `inheritance_claims_notes` | Erwarten Sie eine Erbschaft oder haben Sie noch Anspruch auf… | wealth (Vermögen) | — | ja | wealth_bulk_topics enthält „Es gibt Ansprueche aus einer Erbschaft o…" |
| 132 | `abroad_lived_yes_no` | Haben Sie jemals im Ausland gelebt? | wealth (Vermögen) | — | ja | — |
| 133 | `abroad_stay_period` | In welchem Zeitraum haben Sie im Ausland gelebt? | wealth (Vermögen) | — | ja | abroad_lived_yes_no = „Ja" |
| 134 | `abroad_stay_place` | An welchem Wohnort im Ausland haben Sie gelebt? | wealth (Vermögen) | — | ja | abroad_lived_yes_no = „Ja" |
| 135 | `abroad_employment_details` | Waren Sie im Ausland berufstätig? Bitte nennen Sie Zeitraum … | wealth (Vermögen) | — | ja | abroad_lived_yes_no = „Ja" |
| 136 | `payment_account_holder_first_name` | Wie lautet der Vorname des Kontoinhabers für mögliche Zahlun… | additional (Weitere Angaben) | — | ja | — |
| 137 | `payment_account_holder_last_name` | Wie lautet der Nachname des Kontoinhabers für mögliche Zahlu… | additional (Weitere Angaben) | — | ja | — |
| 138 | `bank_giro_iban` | Wie lautet die IBAN für mögliche Zahlungen? | additional (Weitere Angaben) | — | ja | — |
| 139 | `bank_giro_bic` | Wie lautet die BIC? | additional (Weitere Angaben) | — | ja | — |
| 140 | `bank_giro_name` | Wie heißen die Bank und der Ort der Bank? | additional (Weitere Angaben) | — | ja | — |
| 141 | `p_account_yes_no` | Ist das Konto ein Pfändungsschutzkonto (P-Konto)? | additional (Weitere Angaben) | — | ja | — |
| 142 | `application_reason_notes` | Warum stellen Sie den Antrag oder was möchten Sie uns noch m… | additional (Weitere Angaben) | — | ja | — |
| 143 | `spouse_last_name` | Wie lautet der Nachname Ihres Ehepartners oder Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 144 | `spouse_first_name` | Wie lautet der Vorname Ihres Ehepartners oder Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 145 | `spouse_birth_name` | Wie lautet der Geburtsname Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 146 | `spouse_gender` | Welches Geschlecht hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 147 | `spouse_birthdate` | Wann wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 148 | `spouse_city_of_birth` | In welchem Ort wurde Ihr Partner geboren? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 149 | `spouse_tax_id` | Wie lautet die Steuer-ID Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 150 | `spouse_pension_insurance_number` | Wie lautet die Rentenversicherungsnummer Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 151 | `spouse_citizenship` | Welche Staatsangehörigkeit hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 152 | `spouse_residence_status` | Welchen Aufenthaltsstatus hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 153 | `spouse_entry_to_germany_date` | Wann ist Ihr Partner nach Deutschland eingereist? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_residence_status ≠ „Nicht zutreffend/deutsch" |
| 154 | `spouse_residence_status_other` | Welchen sonstigen Aufenthaltsstatus hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_residence_status = „Sonstiger Status" |
| 155 | `spouse_legal_guardian_yes_no` | Hat Ihr Partner eine gesetzliche Betreuung oder eine bevollm… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 156 | `spouse_legal_guardian_name_address` | Wie heißt die Betreuung oder bevollmächtigte Person Ihres Pa… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_legal_guardian_yes_no = „Ja" |
| 157 | `spouse_disability_card` | Hat Ihr Partner einen Schwerbehindertenausweis oder Feststel… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 158 | `spouse_disability_card_expiry` | Bis wann ist der Schwerbehindertenausweis oder Feststellungs… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Ja" |
| 159 | `spouse_disability_card_application_date` | Wann wurde der Schwerbehindertenausweis oder Feststellungsbe… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Beantragt" |
| 160 | `spouse_disability_card_markers` | Welche Merkzeichen stehen im Schwerbehindertenausweis Ihres … | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_disability_card = „Ja" |
| 161 | `spouse_health_insurance_yes_no` | Ist Ihr Ehepartner / Lebenspartner aktuell krankenversichert… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 162 | `spouse_health_insurance` | Bei welcher Krankenkasse ist Ihr Partner versichert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_yes_no = „Ja" |
| 163 | `spouse_health_insurance_member_since` | Wie lange ist Ihr Partner schon Mitglied dieser Krankenversi… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_yes_no = „Ja" |
| 164 | `spouse_health_insurance_type` | Wie ist Ihr Partner kranken- und pflegeversichert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_yes_no = „Ja" |
| 165 | `spouse_health_insurance_member_id` | Wie lautet die Krankenversicherungsnummer Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_yes_no = „Ja" |
| 166 | `spouse_health_insurance_amount` | Wie hoch ist der monatliche Beitrag Ihres Partners zur Krank… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_type ∈ [freiwillige Versicherung, private Versicherung] |
| 167 | `spouse_care_insurance_amount` | Wie hoch ist der monatliche Beitrag Ihres Partners zur Pfleg… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_type ∈ [freiwillige Versicherung, private Versicherung] |
| 168 | `spouse_foreign_health_insurance_yes_no` | Hat Ihr Partner eine ausländische Krankenversicherung? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 169 | `spouse_foreign_health_insurance_name_address` | Wie heißen die ausländische Krankenversicherung Ihres Partne… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_foreign_health_insurance_yes_no = „Ja" |
| 170 | `spouse_last_health_insurance` | Bei welcher Krankenkasse war Ihr Partner zuletzt versichert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_health_insurance_yes_no = „Nein" |
| 171 | `spouse_last_health_insurance_from` | Ab wann war Ihr Partner dort versichert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_last_health_insurance beantwortet |
| 172 | `spouse_last_health_insurance_until` | Bis wann war Ihr Partner dort versichert? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_last_health_insurance beantwortet |
| 173 | `spouse_pension_type` | Welche Rente oder Pension bekommt Ihr Partner? | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 174 | `spouse_pension_amount_gross` | Wie hoch ist der Bruttobetrag dieser Rente oder Pension pro … | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | spouse_pension_type ∈ [Erwerbsminderungsrente, Altersrente, Unfallrente, …] |
| 175 | `spouse_pension_amount` | Wie hoch ist der Nettobetrag dieser Rente oder Pension pro M… | spouse (Ehepartner / Lebenspartner) | spouse_pension (wiederholbar) | ja | spouse_pension_type ∈ [Erwerbsminderungsrente, Altersrente, Unfallrente, …] |
| 176 | `spouse_pension_application_yes_no` | Hat Ihr Partner eine Rente beantragt, über die noch nicht en… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 177 | `spouse_pension_application_date` | Wann wurde die Rente Ihres Partners beantragt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_pension_application_yes_no = „Ja" |
| 178 | `spouse_pension_application_issuer` | Bei welcher Stelle wurde die Rente Ihres Partners beantragt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_pension_application_yes_no = „Ja" |
| 179 | `spouse_pension_application_insurance_number` | Welche Versicherungsnummer gehört zum Rentenantrag Ihres Par… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_pension_application_yes_no = „Ja" |
| 180 | `spouse_pension_application_type` | Welche Rente wurde für Ihren Partner beantragt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_pension_application_yes_no = „Ja" |
| 181 | `spouse_other_income` | Hat Ihr Partner weiteres Einkommen? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 182 | `spouse_other_income_type` | Welche Art von weiterem Einkommen hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | spouse_other_income (wiederholbar) | ja | spouse_other_income = „Ja" |
| 183 | `spouse_other_income_amount` | Wie hoch ist dieses Einkommen pro Monat? | spouse (Ehepartner / Lebenspartner) | spouse_other_income (wiederholbar) | ja | spouse_other_income_type beantwortet |
| 184 | `spouse_cash_savings_amount` | Wie viel Bargeld hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 185 | `spouse_bank_giro_yes_no` | Hat Ihr Partner Bankguthaben? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 186 | `spouse_bank_giro_amount` | Wie hoch ist das Bankguthaben Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_bank_giro_yes_no = „Ja" |
| 187 | `spouse_bank_savings_account_yes_no` | Hat Ihr Partner Sparguthaben? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 188 | `spouse_bank_savings_account_amount` | Wie hoch ist das Sparguthaben Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_bank_savings_account_yes_no = „Ja" |
| 189 | `spouse_bank_additional_account_yes_no` | Hat Ihr Partner sonstige Kontoguthaben, z. B. PayPal? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 190 | `spouse_bank_additional_name` | Bei welcher Bank haben Sie ein weiteres Konto Ihres Partners… | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 191 | `spouse_bank_additional_iban` | Was ist die IBAN Nummer dieses Kontos Ihres Partners? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 192 | `spouse_bank_additional_bic` | Wie lautet die BIC Ihres Partners? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 193 | `spouse_bank_additional_account_amount` | Wie hoch sind die sonstigen Kontoguthaben Ihres Partners? | spouse (Ehepartner / Lebenspartner) | spouse_bank_additional (wiederholbar) | ja | spouse_bank_additional_account_yes_no = „Ja" |
| 194 | `spouse_funeral_insurance_yes_no` | Hat Ihr Partner einen Bestattungsvorsorgevertrag? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 195 | `spouse_funeral_insurance_amount` | Wie hoch ist der Betrag des Bestattungsvorsorgevertrags Ihre… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_funeral_insurance_yes_no = „Ja" |
| 196 | `spouse_life_insurance` | Hat Ihr Partner eine Kapital- oder Risikolebensversicherung? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 197 | `spouse_life_insurance_total_amount` | Wie hoch ist der Betrag der Lebensversicherung Ihres Partner… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_life_insurance ≠ „Nein" |
| 198 | `spouse_life_insurance_surrender_value` | Wie hoch ist der aktuelle Rückkaufswert der Lebensversicheru… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_life_insurance ≠ „Nein" |
| 199 | `spouse_automobile_yes_no` | Hat Ihr Partner ein Kraftfahrzeug? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 200 | `spouse_automobile_numbers_plate` | Welches amtliche Kennzeichen hat das Kraftfahrzeug Ihres Par… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_yes_no = „Ja" |
| 201 | `spouse_automobile_year` | Aus welchem Baujahr ist das Kraftfahrzeug Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_yes_no = „Ja" |
| 202 | `spouse_automobile_type` | Welches Fahrzeugmodell ist es? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_yes_no = „Ja" |
| 203 | `spouse_automobile_vehicle_type` | Welches ist der Fahrzeugtyp? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_yes_no = „Ja" |
| 204 | `spouse_automobile_mileage` | Wie hoch ist der Kilometerstand des Kraftfahrzeugs Ihres Par… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_automobile_yes_no = „Ja" |
| 205 | `spouse_property_yes_no` | Hat Ihr Partner Haus- oder Wohneigentum? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 206 | `spouse_property_notes` | Bitte geben Sie Adresse, Art und Nutzung des Haus- oder Wohn… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_property_yes_no = „Ja" |
| 207 | `spouse_additional_property_yes_no` | Hat Ihr Partner sonstigen Grundbesitz? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 208 | `spouse_additional_property_notes` | Bitte geben Sie Adresse, Art und Nutzung des sonstigen Grund… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_additional_property_yes_no = „Ja" |
| 209 | `spouse_asset_transfer_yes_no` | Hat Ihr Partner in den letzten 10 Jahren Vermögen an andere … | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 210 | `spouse_asset_transfer_date` | Wann wurde das Vermögen Ihres Partners übertragen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_asset_transfer_yes_no ∈ [Ja - ohne besonderen Vertrag, Ja - siehe beigefuegte Urkunde] |
| 211 | `spouse_asset_transfer_amount` | In welcher Höhe wurde Vermögen Ihres Partners übertragen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_asset_transfer_yes_no ∈ [Ja - ohne besonderen Vertrag, Ja - siehe beigefuegte Urkunde] |
| 212 | `spouse_applicant_bulk_topics` | Trifft eine dieser seltenen Situationen auf Ihren Partner zu… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 213 | `spouse_income_bulk_topics` | Treffen eine oder mehrere dieser besonderen Einkommens- oder… | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 214 | `spouse_expense_bulk_topics` | Gibt es eine oder mehrere dieser absetzbaren Ausgaben? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 215 | `spouse_wealth_bulk_topics` | Gibt es eine oder mehrere dieser besonderen Vermögensarten? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 216 | `spouse_commitment_declaration_date` | Wann hat jemand bei der Ausländerbehörde unterschrieben, fin… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_applicant_bulk_topics enthält „Es besteht eine Verpflichtungserklaerung…" |
| 217 | `spouse_prior_sgb_benefits_provider` | Von welcher Stelle hat Ihr Partner diese Leistungen bekommen… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 218 | `spouse_prior_sgb_benefits_from` | Seit wann hat Ihr Partner diese Leistungen bekommen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 219 | `spouse_prior_sgb_benefits_until` | Bis wann hat Ihr Partner diese Leistungen bekommen? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_applicant_bulk_topics enthält „Es wurden frueher bereits Leistungen nac…" |
| 220 | `spouse_oeg_application_date` | Wann wurde der Antrag Ihres Partners nach dem Opferentschädi… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_income_bulk_topics enthält „Es wurde ein Antrag nach dem Opferentsch…" |
| 221 | `spouse_oeg_application_issuer` | Bei welcher Stelle wurde der Antrag Ihres Partners nach dem … | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_income_bulk_topics enthält „Es wurde ein Antrag nach dem Opferentsch…" |
| 222 | `spouse_foreign_pension_contributions_details` | In welchem Land und in welchem Zeitraum wurden für Ihren Par… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_income_bulk_topics enthält „Es wurde im Ausland gearbeitet und dort …" |
| 223 | `spouse_foreign_work_without_pension_contributions_details` | Wann und wo hat Ihr Partner im Ausland gearbeitet, ohne Rent… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_income_bulk_topics enthält „Es wurde im Ausland gearbeitet, ohne dor…" |
| 224 | `spouse_income_tax_amount` | Wie hoch ist die monatliche Einkommensteuer? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es werden Einkommensteuern gezahlt" |
| 225 | `spouse_social_security_contributions_amount` | Wie hoch sind die monatlichen Sozialversicherungsbeiträge Ih… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es werden Sozialversicherungsbeitraege g…" |
| 226 | `spouse_general_liability_insurance_amount` | Wie hoch ist der monatliche Beitrag der Haftpflichtversicher… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es besteht eine Haftpflichtversicherung" |
| 227 | `spouse_kfz_liability_insurance_amount` | Wie hoch ist der monatliche Beitrag der Kfz-Haftpflichtversi… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es besteht eine Kfz-Haftpflichtversicher…" |
| 228 | `spouse_pension_contributions_amount` | Wie hoch sind die monatlichen Altersvorsorgebeiträge? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es werden Altersvorsorgebeitraege gezahl…" |
| 229 | `spouse_funeral_insurance_contribution_amount` | Wie hoch ist der monatliche Beitrag der Sterbegeldversicheru… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_expense_bulk_topics enthält „Es werden Beitraege zu einer Sterbegeldv…" |
| 230 | `spouse_securities_amount` | Welchen Wert haben die Wertpapiere oder Aktien Ihres Partner… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Wertpapiere oder Aktien" |
| 231 | `spouse_jewelry_metals_amount` | Welchen Wert haben Schmuck oder Edelmetalle Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Schmuck oder Edelmetalle von rel…" |
| 232 | `spouse_additional_wealth_amount` | Welchen Wert hat das sonstige Vermögen Ihres Partners? | spouse (Ehepartner / Lebenspartner) | spouse_additional_wealth (wiederholbar) | ja | spouse_wealth_bulk_topics enthält „Es gibt sonstiges Vermoegen im In- oder …" |
| 233 | `spouse_additional_wealth_type` | Welche Art von sonstigem Vermögen hat Ihr Partner? | spouse (Ehepartner / Lebenspartner) | spouse_additional_wealth (wiederholbar) | ja | spouse_wealth_bulk_topics enthält „Es gibt sonstiges Vermoegen im In- oder …" |
| 234 | `spouse_state_subsidized_private_pension_amount` | Wie hoch ist der Betrag der staatlich geförderten privaten A… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt eine staatlich gefoerderte priva…" |
| 235 | `spouse_state_subsidized_private_pension_due_date` | Wann ist dieser Betrag fällig? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt eine staatlich gefoerderte priva…" |
| 236 | `spouse_private_pension_amount` | Wie hoch ist der Betrag der sonstigen privaten Altersvorsorg… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt eine sonstige private Altersvors…" |
| 237 | `spouse_private_pension_due_date` | Wann ist dieser Betrag fällig? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt eine sonstige private Altersvors…" |
| 238 | `spouse_claims_against_third_parties_type` | Um welche Forderung oder welchen Anspruch Ihres Partners han… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Forderungen oder Ansprueche gege…" |
| 239 | `spouse_claims_against_third_parties_amount` | Wie hoch ist die Forderung oder der Anspruch Ihres Partners? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Forderungen oder Ansprueche gege…" |
| 240 | `spouse_transfer_contract_claims_notes` | Hat Ihr Partner durch einen Vertrag noch Rechte an einem Hau… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Ansprueche aus Uebertragsvertrae…" |
| 241 | `spouse_inheritance_claims_notes` | Erwartet Ihr Partner eine Erbschaft oder hat er noch Anspruc… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_wealth_bulk_topics enthält „Es gibt Ansprueche aus einer Erbschaft o…" |
| 242 | `spouse_abroad_lived_yes_no` | Hat Ihr Partner jemals im Ausland gelebt? | spouse (Ehepartner / Lebenspartner) | — | ja | marital_status ∈ [verheiratet, Lebenspartnerschaft, eheähnliche Gemeinschaft] |
| 243 | `spouse_abroad_stay_period` | In welchem Zeitraum hat Ihr Partner im Ausland gelebt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_abroad_lived_yes_no = „Ja" |
| 244 | `spouse_abroad_stay_place` | An welchem Wohnort im Ausland hat Ihr Partner gelebt? | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_abroad_lived_yes_no = „Ja" |
| 245 | `spouse_abroad_employment_details` | War Ihr Partner im Ausland berufstätig? Bitte nennen Sie Zei… | spouse (Ehepartner / Lebenspartner) | — | ja | spouse_abroad_lived_yes_no = „Ja" |
