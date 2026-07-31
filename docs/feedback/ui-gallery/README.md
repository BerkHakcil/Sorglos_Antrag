# UI-Galerie — Design-Umstellung Schritt für Schritt

> Für Roman: hier liegen zu jedem Schritt Screenshots **vorher und nachher**,
> für Desktop (1280×800) und Handy (375×812). Du brauchst nichts zu
> installieren und keinen Zugang — einfach die Bilder anschauen.
>
> ⚠ Alle Screenshots entstehen mit einem **Testkonto und erfundenen Daten**
> („Maria Musterfrau"). Es ist nie ein echter Fall abgebildet.

---

## E-1 — Farben und Schrift (Design-Tokens)

**Was sich ändert:** ausschließlich Farben, Schriftart und Rundungen. Der
Aufbau der Seiten, alle Texte, alle Fragen und die gesamte Logik bleiben
unverändert.

| Ordner                   | Inhalt                                               |
| ------------------------ | ---------------------------------------------------- |
| `E-1-tokens-BEFORE/`     | der bisherige Stand (aktuell live)                   |
| `E-1-tokens-AFTER/`      | mit dem neuen Design                                 |
| `E-1-border-candidates/` | drei Varianten für die Rahmenfarbe der Eingabefelder |

**Die Bilder (jeweils `-desktop` und `-mobile`):**

| Datei               | Bildschirm                               |
| ------------------- | ---------------------------------------- |
| `01-login`          | Anmeldung                                |
| `02-signup`         | Registrierung                            |
| `03-pre-carehome`   | Pflegeheim auswählen (nur Desktop)       |
| `04-pre-plz`        | Postleitzahl eingeben (nur Desktop)      |
| `05-fragen-fresh`   | Fragebogen, noch nichts beantwortet      |
| `06-fragen-history` | Fragebogen mit den ersten drei Antworten |
| `07-dokumente`      | Unterlagen-Liste                         |

_(03 und 04 gibt es nur einmal: die beiden Schritte werden nur einmal pro
Konto durchlaufen.)_

**Nebenbei behoben:** die App lief bisher versehentlich in der
Standard-Schrift des Browsers (Times New Roman) — die vorgesehene Schrift
war zwar geladen, wurde aber nie angewendet. Ab jetzt ist es durchgängig
**Lato**, so wie in deinem Entwurf. Das ist im Vorher/Nachher-Vergleich der
auffälligste Unterschied neben den Farben.

**Datenschutz-Hinweis:** Lato wird bei uns **selbst ausgeliefert**, nicht von
Google geladen. Damit geht bei keinem Seitenaufruf eine IP-Adresse eines
Angehörigen an Google.

### Offene Frage an dich (Rahmenfarbe der Eingabefelder)

Im Entwurf sind die Rahmen der Eingabefelder sehr hell (`#e6e0d0`). Das sieht
ruhig aus, ist aber zu kontrastarm: Menschen mit eingeschränktem Sehvermögen
erkennen das Feld kaum, und es unterschreitet die Barrierefreiheits-Norm
deutlich. In `E-1-border-candidates/` siehst du dieselben zwei Bildschirme mit
drei Varianten:

| Bild             | Rahmenfarbe | Bewertung                                    |
| ---------------- | ----------- | -------------------------------------------- |
| `*-a-mockup-…`   | `#e6e0d0`   | wie im Entwurf — **zu schwach**, fällt durch |
| `*-b-8c8272`     | `#8c8272`   | die hellste Variante, die die Norm erfüllt   |
| `*-c-graphite-…` | `#5c6166`   | deutlich kräftiger, sicher                   |

Unser Vorschlag ist **b** — so nah wie möglich an deinem Entwurf und trotzdem
gut erkennbar. Sag gern, welche dir am besten gefällt.

---

## E-2 — Bausteine (Knöpfe, Eingabefelder, Karten, Fortschritt, Reiter)

**Was sich ändert:** nur das Aussehen der wiederkehrenden Bausteine. Es
ändert sich **kein Text**, keine Frage, keine Reihenfolge und nichts an der
Funktion.

| Ordner                   | Inhalt                                            |
| ------------------------ | ------------------------------------------------- |
| `E-2-primitives-BEFORE/` | Stand nach E-1 (aktuell live)                     |
| `E-2-primitives-AFTER/`  | mit den neuen Bausteinen                          |
| `E-2-border-candidates/` | die Rahmenfarbe der Eingabefelder, drei Varianten |

**Das Wichtigste im Vergleich:**

1. **Kopfzeile und Reiter** sitzen nicht mehr auf weißen Flächen, sondern auf
   dem cremefarbenen Hintergrund — wie in deinem Entwurf. Weiß ist ab jetzt
   den Inhaltskarten vorbehalten.
2. **Der aktive Reiter** ist petrolfarben und bekommt einen kurzen Strich
   darunter. Vorher war er nur farbig markiert; Farbe allein reicht für
   Barrierefreiheit nicht aus.
3. **Der Zähler bei „Dokumente"** ist von einer gefüllten Blase zu deiner
   Schreibweise „· 11" gewechselt.
   ⚠ In deinem Entwurf steht dort „· 4 **offen**". Das Wort „offen" ist neuer
   deutscher Text — den schreibst du, nicht wir. Bis dahin steht nur die Zahl.
   Sag Bescheid, wenn „offen" (oder ein anderes Wort) dazu soll.
4. **Der Fortschrittsbalken** ist schlanker, der Balken selbst petrol auf
   salbeigrünem Grund, und die Prozentzahl sitzt in einem kleinen petrolfarbenen
   Feld.
5. **Der Haupt-Knopf** (z. B. „Anmelden") ist jetzt kupferfarben mit weißer
   Schrift.
   ⚠ Kupfer verwenden wir **nur als Füllfarbe**, nie als Textfarbe: kupferne
   Schrift auf Creme ist nachweislich zu kontrastarm. Verlinkungen sind
   deshalb petrolfarben.

### Deine Entscheidung: Rahmenfarbe der Eingabefelder

Das ist dieselbe Frage wie bei E-1, jetzt aber sauber getrennt. Wir haben die
Farbe **aufgeteilt**: dünne Trennlinien und Kartenränder behalten dein sanftes
`#e6e0d0`; **nur die Eingabefelder** bekommen einen kräftigeren Rahmen, weil
man dort erkennen muss, wo das Feld anfängt und aufhört.

In `E-2-border-candidates/` siehst du dieselben zwei Bildschirme dreimal —
die Trennlinien sind überall gleich sanft, es ändert sich nur der Rahmen der
Felder:

| Bild             | Rahmen    | Bewertung                                           |
| ---------------- | --------- | --------------------------------------------------- |
| `*-a-mockup-…`   | `#e6e0d0` | wie im Entwurf — **fällt durch**, zu kontrastarm    |
| `*-b-8c8272`     | `#8c8272` | **aktuell eingebaut**, hellste Variante, die reicht |
| `*-c-graphite-…` | `#5c6166` | kräftiger, sicherer, aber weiter weg vom Entwurf    |

Eingebaut ist **b**. Wenn dir das zu dunkel oder zu warm ist, sag es — der
Wechsel ist eine Zeile.

_(Der ältere Ordner `E-1-border-candidates/` zeigt noch die Variante, bei der
Trennlinien und Felder dieselbe Farbe hatten. `E-2-border-candidates/` ersetzt
ihn.)_
