---
status: accepted
open: B480
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (evening)
---

# Windows work is collected and done in one batch on rack

The guest PC `rack` should not run all day for Windows work spread over the day. The doc agent proposed Wake-on-LAN, so
that a builder could switch `rack` on by itself. The human answered "ich komme so einfach nicht ans bios. wir sollten
windows arbeir einfach sammeln und dann auf einen schlag erledigen wenns es sin macht." and confirmed this summary with
"ok":

- No Wake-on-LAN.
- The builders collect all Windows work (for example B480) in one list. `rack` stays off meanwhile.
- When a batch is worth it, the builder asks the human to switch `rack` on. Then it does the whole batch at once and
  shuts `rack` down after it.
- No agent waits for `rack`, and no agent expects `rack` to run.

This replaces ADR 0268: Windows work no longer runs in parallel with the builder queue whenever it comes up.
