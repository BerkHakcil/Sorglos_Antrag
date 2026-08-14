# UI-Runde 2 — Checkpoint 2: Chat-Karte, Unterlagen, Feinschliff

Stand 2026-08-14, nach den Teilschritten R2-3 bis R2-6. Vorher/Nachher
jeweils bei 1280×800 (`-desktop`) und 375×812 (`-mobile`), immer auf einem
Testkonto („Maria Musterfrau"), nie ein echter Fall.

| Was                                    | Vorher                                    | Nachher                                                                           |
| -------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Chat-Karte, Texte, Fortschritt         | [R2-1-shell-BEFORE](../R2-1-shell-BEFORE) | dieser Ordner                                                                     |
| Unterlagen-Liste                       | dieselbe Vorher-Serie                     | [R2-4-docs-AFTER](../R2-4-docs-AFTER)                                             |
| Checkpoint 1 (Seitenleiste, Kopfzeile) | —                                         | [R2-2-header-AFTER](../R2-2-header-AFTER) · [live geprüft](../R2-2-PROD-verified) |

## Was sich sichtbar ändert

**Der Frageverlauf steht jetzt in einer weißen Karte**, wie in deinem
Entwurf — abgesetzt vom Hintergrund, mit weichen Ecken. Die aktuelle Frage
bleibt in ihrer eigenen Karte darunter.

**Zwei Begriffe wechseln** (aus deinem Entwurf übernommen): der Knopf heißt
statt „Weiter" jetzt **„Antwort speichern"**, und „Weiß ich gerade nicht"
heißt jetzt **„Später beantworten"**. Der Überspringen-Knopf ist außerdem
kein zweiter Rahmen-Knopf mehr, sondern ein schlichter unterstrichener Link —
so ist klar, welcher der beiden der Hauptknopf ist.

**Neu am Anfang des Verlaufs**: der Hinweis „Ihre Angaben werden automatisch
gespeichert. Sie können jederzeit pausieren." — der beruhigende Satz aus
deinem Entwurf.

**Die Unterlagen-Liste** bekommt die Maße aus deinem Entwurf: größere
Zeilen, größeres Symbol, größere Schrift für Titel und Status.

## Zwei bewusste Abweichungen von deinem Entwurf

Beides ist Absicht, nicht übersehen:

1. **Die Fragen-Sprechblasen sind cremefarben, nicht weiß.** In deinem
   Entwurf sind sie weiß auf einer weißen Karte — man erkennt sie nur am
   Schatten. Gemessen ist das ein Kontrast von 1,0 zu 1, also praktisch
   keiner. Mit dem cremefarbenen Ton hebt sich die Blase ab, und die Frage
   selbst bleibt gut lesbar.

2. **Der Fortschrittsbalken steht nur auf der Seite „Angaben".** Bei dir
   zählt er die Unterlagen mit; bei uns zählt er **nur die beantworteten
   Fragen**. Die Unterlagen haben ihre eigene Anzeige. Über der
   Unterlagen-Seite würde unser Balken also einen Fortschritt behaupten, den
   er nicht misst.

## Was gleich geblieben ist

Am Handy ändert sich am Aufbau nichts (Kopfleiste oben, Reiter darunter,
Rechtslinks unten) — die Seitenleiste ist bewusst nur für große Bildschirme.
Deine Texte in der Unterlagen-Liste („Ihre Dokumente", „Es fehlen noch …",
„Datei hochladen") bleiben unverändert.

**Ein Hinweis zur Wortwahl:** in der Navigation steht jetzt „Unterlagen"
(dein Entwurf), in der Liste selbst weiterhin „Dokumente" (deine Texte).
Wenn dich das stört, ist das eine kleine Textänderung — sag einfach Bescheid.
