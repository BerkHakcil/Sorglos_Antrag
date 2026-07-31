# Design-Umstellung — Übersicht für Roman (Stand 31.07.2026)

> **Das ist deine eine Seite.** Alle Vorher/Nachher-Bilder der Umstellung
> auf dein Lovable-Design, plus alle offenen Fragen an dich, in einer
> Liste. Details zu jedem Schritt stehen weiter unten in der
> [README](README.md); das technische Paket aus Runde 3 ist
> [roman_package_pass3.md](../roman_package_pass3.md).
>
> Alle Screenshots: Testkonto „Maria Musterfrau", nie ein echter Fall.
> Jeweils `-desktop` (1280×800) und `-mobile` (375×812).

## Die Bilder, Schritt für Schritt

| Schritt | Was sich geändert hat                               | Vorher                                                                                                                        | Nachher                                        |
| ------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| E-1     | Farben, Schrift (Lato), Rundungen                   | [E-1-tokens-BEFORE](E-1-tokens-BEFORE)                                                                                        | [E-1-tokens-AFTER](E-1-tokens-AFTER)           |
| E-2     | Knöpfe, Eingabefelder, Karten, Reiter, Fortschritt  | [E-2-primitives-BEFORE](E-2-primitives-BEFORE)                                                                                | [E-2-primitives-AFTER](E-2-primitives-AFTER)   |
| E-2     | Rahmenfarbe der Eingabefelder (3 Varianten)         | —                                                                                                                             | [E-2-border-candidates](E-2-border-candidates) |
| E-3     | Fragen-Bildschirm als Chat mit Sprechblasen         | [E-3-chat-BEFORE](E-3-chat-BEFORE)                                                                                            | [E-3-chat-AFTER](E-3-chat-AFTER)               |
| E-3     | Die vier Zustände des Chats                         | —                                                                                                                             | [E-3-chat-states](E-3-chat-states)             |
| E-4     | Dokumenten-Liste mit Status-Zeichen                 | [E-4-docs-BEFORE](E-4-docs-BEFORE)                                                                                            | [E-4-docs-AFTER](E-4-docs-AFTER)               |
| E-5     | Anmelden/Registrieren mit Logo, Bestätigungs-Panels | [E-5-auth-BEFORE](E-5-auth-BEFORE)                                                                                            | [E-5-auth-AFTER](E-5-auth-AFTER)               |
| E-6     | „Fertig"- und „In Prüfung"-Zustand                  | [E-6-completion-BEFORE](E-6-completion-BEFORE)                                                                                | [E-6-completion-AFTER](E-6-completion-AFTER)   |
| E-7     | Feinschliff: Bedienbarkeit, Fehlerseite, 404, Laden | _(keine eigene Galerie — Änderungen unter der Haube: Tastatur-Bedienung, Mindestgrößen zum Antippen, reduzierte Animationen)_ |                                                |

## Deine offenen Punkte — bitte in dieser Reihenfolge

1. **„Alle Fragen beantwortet" und „In Prüfung" haben denselben Text.** ⚠ Wichtigster Punkt.
   In der Datenbank steht für beide Zustände wortwörtlich derselbe Satz. Seit E-6 ist das
   kleine Symbol (Haken vs. Uhr) der **einzige** sichtbare Unterschied. Magst du für
   „In Prüfung" einen eigenen Text schreiben? _(Details: README, Abschnitt E-6.)_
2. **Gelb → Salbeigrün** bei den zwei Hinweiskästen (Person-Hinweis, erneut gestellte
   Frage). Begründung steht in der README (E-3); sag Bescheid, falls du Gelb zurück willst.
3. **Rahmenfarbe der Eingabefelder** — zur Kenntnis: entschieden (`#8c8272`), Trennlinien
   bleiben hell. Nur melden, wenn es dir im Alltag zu dunkel/warm vorkommt.
4. **„· 4 offen"** — im Entwurf steht hinter der Zahl das Wort „offen". Das Wort ist
   neuer Text und damit deiner. Sollen wir es ergänzen, und wenn ja: „offen"?
5. **„Nächste Schritte" auf der Fertig-Seite** — die Liste aus deinem Entwurf bauen wir
   erst, wenn ihr Text von dir kommt _(Paket, Punkt 9)_.
6. **404-Seite und Lade-Anzeige** — neu, mit Platzhalter-Text von uns. Deine Fassung
   bitte: siehe [german_copy_for_roman.md](../../document-rules/german_copy_for_roman.md),
   Abschnitt E-7.
7. **Frage-Perspektive („Sie" = wer?)** — deine Formulierungsregel fehlt noch
   _(Paket, Punkt 5)_.
8. **Fragen-Reihenfolge** — deine Ziel-Reihenfolge fehlt noch _(Paket, Punkt 6)_.
9. **Renten-Doppelabfrage (Berlin)** — Entscheidung zu Punkt 7 im Paket steht aus;
   dort auch Punkt 4 (optionale Fragen, zur Kenntnis) und die drei „ss"-Fälle aus Punkt 8.
10. **Ordner-Zuordnung der 43 Dokumente** — zur Kenntnis, flippbare Zeilen auf Zuruf
    _(Paket, Punkt 10)_.
11. **Logo als SVG** — wenn du die Quelldatei hast, tauschen wir das JPG aus. Kein Blocker.
12. **Ansprechpartner-Kasten** (Foto, Name, Telefonnummer aus deinem Entwurf) — deine
    Daten, deine Entscheidung; erst nach deinem Go _(Paket, Punkt 9)_.
13. **Ältere Freigaben** aus früheren Runden — Sammelliste im Paket, Punkt 11.
