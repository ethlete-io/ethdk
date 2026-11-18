# Timetrack - Status

Stand: 19.11.2026

Timetrack ist aktiv. Die Arbeit läuft in der Builder-Warteschlange (ADR 0355), die Zeilen stehen in
[`plans/studio/STATUS.md`](../studio/STATUS.md). Hier stehen sie nicht doppelt.

## Warteschlange (nächstes oben)

1. B602: Anwesenheit neu bauen (Befund #27, Revert 363745c), dann #4, #5 (Beschreibungen). #22 gebaut (19fa204d6). #11 ist
   wahrscheinlich durch 714b49bc9 behoben, die Linux-Maschine läuft vermutlich auf einem alten Build.
2. B616: gekoppelte Rechner zeigen denselben Tag, auch Handzeilen, Änderungen, Regeln und Vertretungen; SSH-Arbeit auf
   tank erscheint auf dem Mac (ADR 0047, Befunde #7, #15, #24, #25, #26).
3. Roadmap-Meilensteine M5 bis M11: [`roadmap.md`](./roadmap.md). Ein Meilenstein wird erst nach Plan
   mit dem Menschen gebaut.

## Offene Plan-Dateien

- [`roadmap.md`](./roadmap.md): die eine Liste der offenen Arbeit nach Meilenstein. Beschlossenes steht in `libs/timetrack/docs/adr/` (0042 bis 0044).
- [`findings-2026-11-17-demo-prep.md`](./findings-2026-11-17-demo-prep.md): Befunde aus dem Aufräumen von 16 Tagen
  über das Agent-CLI. Behobene sind durchgestrichen.
- [`one-session-one-piece.md`](./one-session-one-piece.md): ein Stand-in pro Arbeitsstück, nur offene Reste (ADR 0043).
- [`ticket-flow.md`](./ticket-flow.md): Ticket anlegen in drei Klicks, nicht begonnen.
- [`auto-mode.md`](./auto-mode.md): nur offene Reste (ADR 0035, 0044).
- [`booking-lessons.md`](./booking-lessons.md): Regeln aus einem Monat Handbuchung, Lektion 5 offen.
- [`m7-sync-research.md`](./m7-sync-research.md): Recherche und Entscheidungen zum M7-Sync (ADR 0039).
- [`lib-scan-integrations.md`](./lib-scan-integrations.md), [`lib-scan-jira-tempo-model.md`](./lib-scan-jira-tempo-model.md):
  offene Befunde des Lib-Scans vom 28.09.

## Verweise

Glossar: [`libs/timetrack/CONTEXT.md`](../../libs/timetrack/CONTEXT.md). Entscheidungen:
[`libs/timetrack/docs/adr/`](../../libs/timetrack/docs/adr/). Tests: [`apps/timetrack/TESTING.md`](../../apps/timetrack/TESTING.md).
