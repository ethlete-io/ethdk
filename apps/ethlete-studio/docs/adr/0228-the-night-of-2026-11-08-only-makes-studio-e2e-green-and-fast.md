---
status: accepted
open: B434
decided: 2026-11-08
source: doc-agent session 2026-11-08, night plan
---

# The night of 2026-11-08 only makes the Studio e2e suite green and fast

Tom: "es ist in Ordnung wenn die Reparaturen die Zeit brauchen. Das sollte der Fokus der Nacht sein. Neue Sachen aus
der Warteschlange nicht. Es geht hier nun nicht darum das Session Limit zu verbrennen sondern die Zeit zu nutzen. Wir
verbrauchen hier wenig Limit aber schaffen die nervigen Parts. Das trifft also voll auf e2e fixen und schnell machen.
Nötige fixes müssen natürlich gemacht werden. Aber nun keine neuen Dinge keine Features oder sonstiges. Der Scope darf
nicht explodieren. Zu wenig pushen ist keine Lösung zu viel aber auch nicht."

Tom on watchdogs: "Da diese fixes einfach nur Zeit fressen und kaum tonend wird es keine Wecker brauchen. Ist das
trotzdem der Fall ist der scope explodiert und du hast meine Anweisung ignoriert."

- The only goal of the night: the Studio e2e suite passes (the rest of B434, including the Chip panel case) and runs
  fast (finding 591, 5 min budget). No time limit on it.
- No new items from the queue: no features, no B249, and 586 and 590 wait. Only fixes that this goal needs; the
  fixture assertion of finding 592 and the all-cores CI run of finding 593 count as such.
- The doc agent records new findings at once; the builder builds one that night only if the goal needs it.
- The builder pushes when a fix is green locally and the running CI run has finished. The doc agent does not push.
- No claude-at watchdogs. A session that reaches a usage limit means the scope grew, against this decision.
- When the suite is green, fast and blocking again (ADR 0227), the builder writes a morning report and stops.
