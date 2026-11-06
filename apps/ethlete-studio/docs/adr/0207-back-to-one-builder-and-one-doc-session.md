---
status: accepted
open: B408
decided: 2026-11-06
source: grill session 2026-11-06
---

# Back to one builder and one doc session

Three builders in parallel (a tool builder, a second tool builder, a UI builder; ADRs 0198 and 0200) did not pay off:
their uncommitted files blocked Tom's merges, heavy design runs shared the CPU, and Tom could not tell the sessions
apart by their names. Tom: "ne wir gehen wieder zurück zu 2 sessions (ein doc ein builder) die anderen sollen dann
runterfahren das bringt so nichts." The tool builder (c0) stays and takes over the queues of the other two from their
handoff files; the others commit their state, write a handoff and shut down. Tom: "ok" (option a, recommended).
Messages to Tom name a session by its role, never by its session id.
