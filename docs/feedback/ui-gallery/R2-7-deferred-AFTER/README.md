# UI-Runde 2 — R2-7: Übersprungene Fragen sichtbar machen

Stand 2026-08-14. Testkonto „Maria Musterfrau", nie ein echter Fall.

## Was neu ist

Wenn jemand eine Frage mit **„Später beantworten"** zurückstellt, verschwindet
sie nicht mehr spurlos. Die Frage bleibt im Verlauf stehen, und an der Stelle,
wo sonst die Antwort steht, erscheint ein kleiner Hinweis mit Uhr-Symbol:
_Später beantworten_.

So sieht man beim Zurückscrollen, was man noch offen hat.

## Was sich NICHT ändert

- Das Zurückstellen selbst funktioniert genau wie vorher.
- Eine zurückgestellte Frage gilt weiter als **nicht beantwortet** — sie zählt
  im Fortschritt weiter mit und wird am Ende noch einmal gestellt.
- Es wird nichts gespeichert (geprüft: nach dem Zurückstellen liegen genauso
  viele Antworten in der Datenbank wie davor).

## Bewusst anders als im Entwurf

In deinem Lovable-Entwurf ist diese Funktion **defekt**: dort bleibt eine
zurückgestellte Frage aktiv, sodass der kursive Hinweis live gar nie
erscheint. Unsere Umsetzung folgt deshalb der Absicht aus deinem Code, nicht
dem Verhalten der Demo — bei uns springt der Fragebogen korrekt zur nächsten
Frage weiter und der Hinweis bleibt im Verlauf stehen.

Zwei weitere Details:

- Der Hinweis ist **keine Sprechblase**. Eine beantwortete Frage hat eine
  gefüllte petrolfarbene Blase, eine zurückgestellte gar keine — der
  Unterschied liegt also in der Form, nicht nur in der Farbe.
- **Kein Warnton**: kein Rot, kein Orange. Etwas später zu beantworten ist ein
  normaler Schritt, keine Fehlermeldung.

## Hinweis für später

Der Hinweis gilt **für die aktuelle Sitzung**. Wer die Seite neu lädt oder
sich später erneut anmeldet, sieht die Markierungen nicht mehr — die Frage
wird dann ganz normal wieder gestellt. Das war schon vorher so und wurde
bewusst nicht geändert.
