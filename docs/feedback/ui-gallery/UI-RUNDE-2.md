# UI-Runde 2 — Vorher/Nachher auf einen Blick

> **Das ist deine eine Seite für diese Runde.** Alles, was sich am Aussehen
> geändert hat, mit Bildern. Stand 2026-08-14, alles live.
>
> Alle Bilder: Testkonto „Maria Musterfrau", nie ein echter Fall. Jeweils
> `-desktop` (1280×800) und `-mobile` (375×812 bzw. 375×667).

## Kurz gesagt

Die App folgt jetzt deinem Lovable-Entwurf: **Seitenleiste am Computer**,
**personalisierte Überschrift**, **neuer Fortschrittsbalken**, **Chat-Karte**.
Die **Mobilansicht ist bewusst unverändert** geblieben.

## Die Bilder, Schritt für Schritt

| Schritt | Was sich geändert hat | Vorher | Nachher |
| --- | --- | --- | --- |
| Referenz | Dein Entwurf, alle Bildschirme | — | [Entwurf](R2-mockup-reference) |
| R2-1 | Seitenleiste, Navigation „Angaben/Unterlagen" | [vorher](R2-1-shell-BEFORE) | [nachher](R2-1-shell-AFTER) |
| R2-2 | Überschrift „Antrag für …", Fortschrittsbalken | [vorher](R2-1-shell-BEFORE) | [nachher](R2-2-header-AFTER) · [live](R2-2-PROD-verified) |
| R2-3 | Chat-Karte, „Antwort speichern", Auto-Speichern-Hinweis | [vorher](R2-1-shell-BEFORE) | [nachher](R2-3-chat-AFTER) |
| R2-4 | Unterlagen-Liste in den Maßen des Entwurfs | [vorher](R2-1-shell-BEFORE) | [nachher](R2-4-docs-AFTER) |
| R2-6 | Feinschliff (Bedienbarkeit) · live geprüft | — | [live](R2-6-PROD-verified) |
| R2-7 | Übersprungene Fragen sichtbar | — | [nachher](R2-7-deferred-AFTER) |

## Was du beim Durchsehen wissen solltest

**Am Computer (ab 1024 Pixel)** gibt es links eine Seitenleiste: Logo und
Claim oben, darunter **„Angaben"** und **„Unterlagen"** (der aktive Punkt
kupfern gefüllt), unten **Hilfe**, **Abmelden** und die Rechtslinks. Die alte
schmale Kopfleiste entfällt dort — alles daraus ist umgezogen.

**Am Handy bleibt der Aufbau wie bisher.** Die Seitenleiste ist absichtlich
nur für große Bildschirme.

**Die Überschrift** nennt jetzt die pflegebedürftige Person: „Antrag für
Vorname Nachname", sobald beide Namen beantwortet sind. Vorher steht wie
gehabt „Mein Hilfe zur Pflege Antrag".

**Umbenennungen aus deinem Entwurf:** „Fragen" → **„Angaben"**, „Dokumente" →
**„Unterlagen"**, „Weiter" → **„Antwort speichern"**, „Weiß ich gerade nicht"
→ **„Später beantworten"**.

**Weggefallen:** die kleine graue Zeile mit Fall-Nummer, PLZ und Status, und
der separate grüne Kasten über den Fragen — sein Satz steht jetzt einmal oben
unter der Überschrift statt zweimal auf der Seite.

## Vier bewusste Abweichungen von deinem Entwurf

Damit nichts davon wie ein Versehen aussieht:

1. **Fragen-Sprechblasen sind cremefarben, nicht weiß.** Im Entwurf sind sie
   weiß auf weißer Karte — messbar praktisch kein Kontrast. Cremefarben hebt
   sich die Blase ab, die Frage bleibt gut lesbar.
2. **Der Fortschrittsbalken steht nur bei „Angaben".** Bei dir zählt er die
   Unterlagen mit, bei uns nur die beantworteten Fragen; die Unterlagen haben
   ihre eigene Anzeige.
3. **„Später beantworten" funktioniert bei uns wirklich.** In der Demo bleibt
   eine zurückgestellte Frage aktiv — dort ist die Funktion defekt. Details in
   [R2-7](R2-7-deferred-AFTER).
4. **Wortwahl:** die Navigation sagt „Unterlagen" (dein Entwurf), die Liste
   selbst weiter „Dokumente" (deine Texte). Wenn dich das stört, ist es eine
   kleine Textänderung — sag Bescheid.

## Nicht übernommen

Aus deinem Entwurf bewusst **nicht** gebaut: die Pillen-Knöpfe statt Auswahl-
felder, die kurz eingeblendete Meldung „Antwort geändert", und der Stift statt
„Bearbeiten". Gründe: die Pillen würden die bewährte Bedienung auf dem Handy
gefährden, die anderen beiden bringen keinen Mehrwert gegenüber dem, was schon
da ist. Falls du eines davon doch möchtest, sag es — dann bauen wir es.
