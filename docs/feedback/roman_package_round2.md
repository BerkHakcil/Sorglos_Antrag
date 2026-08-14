# Roman-Paket — Go-live-Runde 2 (2026-08-13)

> Eine Nachricht, versandfertig — Erman schickt sie. Antworten gehen als
> ClickUp-Kommentare zurück; jede Freigabe/Umformulierung wird eine kleine
> UPDATE-Migration. Kontext für uns (nicht Teil der Nachricht):
> `docs/feedback/golive_round2.md`.

> **ANSWERS RECEIVED 2026-08-13 (via the founder) — package closed:**
> item 1 Essen-Sterbeurkunde: **JA** → `ESS-056` (migration
> `20260813000007`); item 2 wording: **approved as proposed** incl. spouse
> mirror → migration `20260813000006` (optional „Wann…" symmetry not
> taken); items 3+4 texts + all other placeholders: **approved via the
> founder's blanket waiver** ("approved by Erman 2026-08-13, Roman review
> waived"); item 5 / Klaus dates: **leave as is** — re-confirmation ask
> withdrawn, no data touched; point 6 office names: covered by the waiver;
> point 7 ops note: acknowledged. Photo: Roman sends later (non-blocking).
> Dispositions ledgered in `german_copy_for_roman.md`.

---

Hallo Roman, fünf Punkte aus deiner Review-Runde — vier davon sind gebaut und
warten nur auf deine Worte, einer ist eine Frage an dich.

**1) Sterbeurkunde bei „verwitwet" — eine Frage an dich.**
Deine Beobachtung war fast richtig, aber an anderer Stelle als gedacht: Für
**Pankow** (und alle Fälle, die die Standard-Liste bekommen) gibt es die Regel
bereits — sie funktioniert nachweislich, ein echter verwitweter Fall hat die
Sterbeurkunde dort schon hochgeladen. Dein eigener Test hat nichts angezeigt,
weil dein Testfall den **Familienstand noch nicht beantwortet** hatte — ohne
diese Antwort kann die Liste den Eintrag nicht zeigen (so gebaut mit Absicht:
keine Antwort, keine Vermutung). **Die einzige echte Lücke ist Essen:** Das
Essener Regelwerk verlangt die Sterbeurkunde des Partners bisher nicht, und
deine Master-Tabelle führt das Dokument nur unter Pankow.
**Frage: Verlangt das Sozialamt Essen die Sterbeurkunde des verstorbenen
Partners bei verwitweten Antragstellern?** Wenn ja, ergänzen wir die Regel
(ein Eintrag, kein Risiko für Bestandsfälle); wenn nein, bleibt alles wie es
ist.

**2) „Doppelte" Behörden-Frage — kein Duplikat, aber dein Wort ist gefragt.**
Die beiden Fragen betreffen zwei verschiedene Dokumente:
„Welche Behörde hat **Ihr Personaldokument** ausgestellt?" gehört zum
Personalausweis-Block (sieht jeder). „Welche Behörde hat **den Ausweis**
ausgestellt?" gehört zum Block **Vertriebenen-/Spätaussiedlerausweis** und
erscheint nur, wenn dort nicht „Nein" gewählt wurde — direkt hinter „Wann
wurde der Ausweis ausgestellt?". Im Chat-Verlauf ist der Bezug klar, in der
Übersicht wirkt es wie ein Duplikat. Löschen wäre falsch (die Angabe wird
gebraucht). Vorschlag zur Klarstellung — **jedes Wort ist deins**:

| Heute live                                                    | Vorschlag                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Welche Behörde hat den Ausweis ausgestellt? _(Antragsteller)_ | Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis ausgestellt?                |
| Welche Behörde hat den Ausweis ausgestellt? _(Partner)_       | Welche Behörde hat den Vertriebenen- oder Spätaussiedlerausweis Ihres Partners ausgestellt? |

Optional für Symmetrie auch die beiden „Wann wurde der Ausweis
ausgestellt?"-Fragen. Alternative: Fragen so lassen und stattdessen eine
kleine Hilfezeile ergänzen, die den Ausweis benennt. → Freigeben, umformulieren
oder „so lassen".

**3) Abschluss-Karte, wenn noch Unterlagen fehlen — Texte zum Absegnen.**
Gebaut wie besprochen: Wer alle Fragen beantwortet hat, aber noch Unterlagen
schuldet, sieht statt „Sie müssen nichts weiter tun" jetzt eine Karte, die
zu den Dokumenten führt (mit Button, und die Nächste-Schritte-Liste beginnt
mit dem Hochladen). Sind alle Unterlagen da, bleibt die heutige Karte
unverändert. Die vier neuen Texte sind Platzhalter — **bitte absegnen oder
umformulieren:**

> **Überschrift:** „Es fehlen noch Unterlagen"
> **Text:** „Sie haben alle Fragen beantwortet — vielen Dank. Damit wir Ihren Antrag prüfen können, laden Sie bitte noch die fehlenden Unterlagen hoch."
> **Button:** „Zu den Dokumenten"
> **Neuer erster Schritt der Liste:** „Sie laden die noch fehlenden Unterlagen hoch."

**4) Schwerbehindertenausweis ohne Ablaufdatum — gebaut, Texte zum Absegnen.**
Vor der Frage „Bis wann ist Ihr Schwerbehindertenausweis gültig?" kommt jetzt
eine Ja/Nein-Frage; nur bei „Nein" wird nach dem Datum gefragt. Gilt für
Antragsteller **und** Partner, in beiden Fragebögen. Platzhalter-Texte:

> **Antragsteller:** „Ist der Ausweis unbefristet gültig?"
> **Partner:** „Ist der Ausweis Ihres Partners unbefristet gültig?"

Stilfrage: In Essen heißt es in den Nachbarfragen durchgehend
„Schwerbehindertenausweis oder Feststellungsbescheid" — sollen die beiden
Essener Fragen das statt „Ausweis" ausschreiben?

**5) Datumsfelder — umgesetzt, mit einer bewussten Ausnahme.**
Ablauf- und Fälligkeitsdaten (Personaldokument, Schwerbehindertenausweis,
Miete-bezahlt-bis, Kündigungsdatum, private Altersvorsorge u. ä.) akzeptieren
jetzt Daten bis **heute + 10 Jahre**. Deine Formulierung „alle Felder" haben
wir bewusst eng ausgelegt: **Geburtsdaten (und andere Vergangenheits-Daten)
bleiben bewusst vergangenheitsbeschränkt** — ein Geburtsdatum im Jahr 2031
wäre ein Tippfehler, kein Wunsch. Sag Bescheid, falls du das anders siehst.

**Dazu eine Bitte (Kundengespräch, dein Ermessen wie):** Beim echten Fall
(Klaus Schinzel) stehen als „gültig bis" für Personalausweis **und**
Schwerbehindertenausweis jeweils exakt **11.08.2027** — beide genau ein Jahr
nach dem Ausfülltag, beide knapp unter der alten Datumsgrenze. Gut möglich,
dass die echten Daten später liegen und die alte Grenze im Weg war. Magst du
die beiden Daten bei Gelegenheit mit dem Sohn/der Familie bestätigen? Wenn
sie korrigiert werden müssen, machen wir das auf Ops-Seite (der Fall ist
gesperrt). **Wichtig für uns: erst kurz Bescheid geben, dann korrigieren** —
eine unserer Prüfungen ist auf den heutigen Wert geeicht.

---

Und zwei Punkte von unserer Seite (nicht aus deiner Review):

**6) Berliner Bezirksämter — interne PLZ-Zuordnung korrigiert; 11 Amtsnamen zum Bestätigen.**
Bislang zeigten alle Berliner Postleitzahlen außerhalb deiner Pankow-Liste
intern auf einen Sammel-Eintrag „Sozialamt Berlin". Jetzt bekommt jede
Berliner PLZ ihr tatsächliches Bezirksamt (nach offizieller Gebietszuordnung;
bei PLZs über Bezirksgrenzen hinweg entscheidet der flächengrößte Anteil).
**Für die Nutzer ändert sich nichts Sichtbares:** Solange ein Bezirk kein
eigenes Regelwerk hat, sehen sie weiter die allgemeine Liste mit dem Hinweis
darüber — nur die interne Zuständigkeit stimmt jetzt. Die 11 neuen Ämter
tragen die offiziellen Bezeichnungen (Quelle: berlin.de) — **bitte einmal
drüberschauen, bestätigen oder korrigieren:**

1. Bezirksamt Mitte von Berlin – Amt für Soziales
2. Bezirksamt Friedrichshain-Kreuzberg von Berlin – Amt für Soziales
3. Bezirksamt Charlottenburg-Wilmersdorf von Berlin – Amt für Soziales
4. Bezirksamt Spandau von Berlin – Amt für Soziales
5. Bezirksamt Steglitz-Zehlendorf von Berlin – Amt für Soziales
6. Bezirksamt Tempelhof-Schöneberg von Berlin – Amt für Soziales
7. Bezirksamt Neukölln von Berlin – Amt für Soziales
8. Bezirksamt Treptow-Köpenick von Berlin – Amt für Soziales
9. Bezirksamt Marzahn-Hellersdorf von Berlin – Amt für Soziales
10. Bezirksamt Lichtenberg von Berlin – Amt für Soziales
11. Bezirksamt Reinickendorf von Berlin – Amt für Soziales

(Pankow bleibt im System unverändert „Sozialamt Berlin-Pankow".)

**Dazu eine Randnotiz, keine Frage — nur damit du es weißt:** Die vier
Grenz-PLZs **10119, 10247, 10249, 13051** bleiben wie im Juli von dir
entschieden bei Pankow („im Zweifel dazunehmen"). Der Kontext hat sich seither
leicht geändert: Damals hätten diese Nutzer ohne die Zuordnung ohnehin die
Pankow-Liste gesehen — als wäre es ihre eigene, einen Hinweis gab es noch
nicht. Heute wäre die Alternative dieselbe Liste, aber ehrlich als allgemeine
Liste mit dem Hinweisbanner gekennzeichnet. Wenn dir das inzwischen lieber
ist, ist die Umstellung ein Einzeiler — deine Entscheidung, keine Eile.

**7) Ops-Hinweis:** rico ist Marzahn-Hellersdorf — seine Checkliste ist
bewusst die allgemeine; beim Einreichen seines Antrags MH-Anforderungen einmal
manuell gegenprüfen.

Danke dir!
