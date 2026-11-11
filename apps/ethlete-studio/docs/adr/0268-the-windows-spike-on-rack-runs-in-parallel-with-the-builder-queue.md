---
status: accepted
open: B480
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (afternoon)
---

# The Windows spike on rack runs in parallel with the builder queue

B480, the CEF spike on the guest PC `rack`, sat at the end of the Linux builder queue. The human answered "das kann foch paralel laufen windows idt js deperste hsrdware" (meaning: "das kann doch parallel laufen,
windows ist separate hardware"): the spike runs now, in a subagent of the builder, beside the
builder's other work. `rack` is separate hardware, so the spike competes with no Linux job for the machine. The
builder works its own queue on in the same order.
