# UI-Runde 2 — Checkpoint 1: Seitenleiste, Kopfzeile, Fortschritt

Stand 2026-08-14, Zwischenstand nach den Teilschritten R2-1 und R2-2.
Vorher/Nachher jeweils bei 1280×800 (`-desktop`) und 375×812 (`-mobile`),
immer auf einem Testkonto („Maria Musterfrau"), nie ein echter Fall.

| Was                            | Vorher                                    | Nachher                                 |
| ------------------------------ | ----------------------------------------- | --------------------------------------- |
| Seitenleiste (R2-1)            | [R2-1-shell-BEFORE](../R2-1-shell-BEFORE) | [R2-1-shell-AFTER](../R2-1-shell-AFTER) |
| Kopfzeile + Fortschritt (R2-2) | dieselbe Vorher-Serie                     | dieser Ordner                           |

## Was sich sichtbar ändert

**Am Computer (ab 1024 Pixel Breite)** gibt es jetzt eine Seitenleiste links,
wie in deinem Entwurf: Logo und Claim oben, darunter die Navigation
**„Angaben"** und **„Unterlagen"** (der aktive Punkt ist kupfern gefüllt),
unten **Hilfe**, **Abmelden** und die Rechtslinks. Die frühere schmale
Kopfleiste über der ganzen Seite entfällt dort — alles, was darin stand, ist
in die Seitenleiste umgezogen.

**Am Handy bleibt alles wie bisher**: Kopfleiste oben, Reiter darunter,
Rechtslinks unten. Die Seitenleiste ist bewusst nur für große Bildschirme.

**Umbenennungen** (aus deinem Entwurf übernommen): aus „Fragen" wird
**„Angaben"**, aus „Dokumente" wird **„Unterlagen"**.

**Die Überschrift** nennt jetzt die pflegebedürftige Person:
**„Antrag für Vorname Nachname"**, sobald beide Namen beantwortet sind.
Darunter steht der erklärende Satz — auf der Seite „Angaben" ist das
**dein bestehender Satz** („Die folgenden Fragen beziehen sich ausschließlich
auf die Person, die im Pflegeheim lebt…"). Er stand vorher zusätzlich als
grüner Kasten darunter; jetzt steht er **nur noch einmal**, oben.

**Der Fortschrittsbalken** bekommt die Sprechblase mit der Prozentzahl und den
Punkt, die mitwandern — wie in deinem Entwurf. Der Zusatz „2 von 53 Fragen
beantwortet" bleibt bewusst stehen: die Zahl sagt mehr als nur ein Prozentwert.

**Ein bewusster Unterschied zu deinem Entwurf** (keine Nachlässigkeit): Der
Balken steht bei uns **nur auf der Seite „Angaben"**, nicht über beiden Seiten.
Grund: Bei dir zählt der Balken die Unterlagen mit (halb Fragen, halb
Hochgeladenes). Bei uns zählt er **ausschließlich die beantworteten Fragen** —
die Unterlagen haben ihre eigene Anzeige („Es fehlen noch 11 Dokumente" und die
Zahl neben „Unterlagen"). Würden wir unseren Fragen-Balken über die
Unterlagen-Seite setzen, würde er einen Fortschritt behaupten, den er gar nicht
misst. Deshalb steht er dort, wo das gilt, was er zählt.

**Weggefallen** ist die kleine graue Zeile mit Fall-Nummer, PLZ und Status.
Den Status sagen die Abschluss-Karten ohnehin in ganzen Sätzen, und die
Fall-Nummer war nur für uns intern.

## ⚠ Zwei Hinweise zu diesen Bildern

1. **Die Überschrift zeigt hier noch „Mein Hilfe zur Pflege Antrag"**, nicht
   „Antrag für Maria Musterfrau". Das ist **kein Fehler**: der dafür nötige
   Textbaustein liegt in einer Datenbank-Änderung, die noch nicht eingespielt
   ist. Solange er fehlt, zeigt die App bewusst den bisherigen Titel statt
   einer halbleeren Zeile. Nach dem Einspielen erscheint der Name automatisch.
2. Die Aufnahmen entstanden auf einer lokalen Testinstallation, weil der
   Zugang zu den Vorschau-Adressen derzeit nicht funktioniert. Inhaltlich ist
   es derselbe Stand wie im Branch.
