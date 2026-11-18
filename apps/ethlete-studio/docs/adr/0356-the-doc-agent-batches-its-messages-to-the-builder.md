---
status: accepted
open: B600
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, point C3, approved by the human with "c3ok", relayed by the analysis session
---

# The doc agent batches its messages to the builder

In 8 days the sessions sent 2543 peer messages. Each message to the builder starts about 7 builder turns, 38% of all
builder turns. The analysis session proposed the point below and named its cost: the builder learns some things up to
15 minutes later. The human answered (verbatim):

> c3ok

1. The doc agent collects what it has for the builder for about 15 minutes and then sends one message with only what
   the builder needs now.

An item that blocks the builder's current row, or says its current work is wrong, goes out at once. This is ADR 0351
applied to messages (a new finding interrupts only on red CI or when it blocks the current row), not a new ruling of
the human.
