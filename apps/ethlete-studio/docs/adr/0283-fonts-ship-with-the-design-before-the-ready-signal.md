---
status: accepted
open: B506
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning), exits from B498 (ADR 0280)
---

# Fonts ship with the design, before the ready signal

The builder planned B498 and moved three findings out of it. The human answered (German, verbatim):

> Q5 – Ja, mit einer Ergänzung zu den Schriften. 466 und 733: einverstanden. […] 811 als eigene Zeile „Schriften
> selbst ausliefern": einverstanden, die Ursache ist kein Timing. Dann gehört aber 815 mit in diese Zeile. […]
> Reihenfolge: die Schrift-Zeile vor B498 bauen. Sind die Schriften mitgeliefert und auf beiden Systemen gleich, wird
> der Schrift-Teil des „Seite bereit"-Signals einfacher, und 924 lässt sich sauber prüfen.

- 466 leaves B498 (built, diff tolerance). 733 moves to B503.
- New row B506: self-hosted fonts, equal on every OS, font URLs in embedded CSS resolved and checked; 811 and 815.
- B506 is built before B498.

## Addendum 2026-11-12: the font of the sdk drawings

The builder found that the sdk product draws with the OS font (`system-ui`, `ui-monospace`). The doc agent asked
which pair the sdk drawings use. The human answered (German, verbatim; the second bullet came through garbled and the
human confirmed the doc agent's reading, given in brackets):

> Q2 – Ja, Noto Sans und Noto Sans Mono, nur in den Zeichnungen. Zwei Schärfungen:
>
> - Eine Quelle: Die SDK-Zeichnungen nutzen dieselben Schriftdateien wie Studio, keine zweite Kopie. Sonst laufen die
>   beiden bei der nächsten Aktualisierung auseinander, und der Vergleich schlägt wieder ohne echte Änderung fehl.
> - [Die Dateien liegen der Zeichnung bei und werden nicht vom Netz geladen.]
>
> [Warum nicht ein anderes Paar: Das verdoppelt die Pflege. Warum nicht die Schrift in der Bibliothek: Das ist eine
> Änderung für alle Apps, nur um ein Werkzeugproblem zu lösen.]

- The sdk drawings use Noto Sans and Noto Sans Mono, in the drawings only. The library CSS of `@ethlete/components`
  stays unchanged.
- One source: the same font files as studio, no second copy.
- The font files ship locally with the drawing; nothing is loaded from the network.
