# UI-Runde 2 — Referenzgalerie des Mockups (Stand 2026-08-14)

Referenz-Screenshots des Lovable-Mockups für die zweite UI-Runde
(Sidebar-Layout). Quelle: https://sorglos-antrag-stellen.lovable.app/,
Repo-Commit `8ea545f` (identisch mit der A12-Baseline — seit dem
2026-07-30 gab es **keine Änderungen** am Mockup). Aufgenommen mit
`scripts/r2-mockup-gallery.mjs` bei 1280×800 (`-desktop`) und 375×812
(`-mobile`); alle Eingaben sind synthetische Testdaten („Maria
Musterfrau", Sparkasse/Volksbank Testhausen, Beispiel-IBAN aus dem
Mockup-Platzhalter).

| Datei | Zustand |
| --- | --- |
| `01-angaben-fresh-*` | Fragen-Chat, frisch: Autosave-Hinweis, Frage 1, Texteingabe, „Antwort speichern" (deaktiviert) |
| `02-angaben-date-input-*` | Datumsfrage mit nativem Datumsfeld |
| `03-angaben-choice-chips-*` | Auswahl-Chips (Familienstand, 4 Optionen) |
| `04-angaben-yesno-chips-*` | Ja/Nein-Chips |
| `05-angaben-history-bubbles-aendern-*` | Verlauf mit Antwort-Bubbles, „Ändern" + Häkchen |
| `06-angaben-edit-mode-*` | Bearbeitungsmodus einer gespeicherten Antwort |
| `07-angaben-flash-antwort-geaendert-*` | Flash-Pille „Antwort geändert" (1,6 s sichtbar) |
| `08-angaben-all-answered-*` | Abschluss-Bubble „Alle Fragen sind beantwortet" |
| `09-unterlagen-empty-*` | Unterlagen-Liste, leer („Noch hochladen") |
| `10-unterlagen-partial-uploaded-*` | Teilweise hochgeladen (Salbei-Tönung, „Ersetzen"/„Entfernen") |
| `11-unterlagen-all-uploaded-banner-*` | Alles-hochgeladen-Banner (vor der Auto-Weiterleitung) |
| `12-fertig-completion-*` | `/fertig`: Petrol-Medaillon, „Nächste Schritte", Kontaktblock |
| `13-hilfe-sheet-desktop` / `13-mobile-menu-sheet-mobile` | Hilfe-Sheet (Desktop) bzw. Hamburger-Menü (Mobil) mit Ansprechpartner |
| `14-login-*`, `15-register-*`, `16-email-sent-*` | Auth-Screens |
| `17-notfound-404-*` | 404-Seite |

Hinweise (nur Demo-Artefakte, nicht Teil des Designs):

- Das „Edit with Lovable"-Badge unten rechts gehört zur Lovable-Hosting-
  Umgebung.
- **„Später beantworten" ist in der Demo funktionslos** (eine übersprungene
  Frage bleibt aktiv); der kursive Übersprungen-Marker aus dem Quellcode ist
  live nicht erreichbar. Als Referenz für E-8 gilt daher der Quellcode
  (`src/routes/index.tsx`), nicht das Live-Verhalten.
- Die Auto-Weiterleitung nach `/fertig` (800 ms nach dem letzten Upload) ist
  Demo-Verhalten und wird nicht übernommen.
