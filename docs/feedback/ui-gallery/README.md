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
