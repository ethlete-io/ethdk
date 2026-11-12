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
