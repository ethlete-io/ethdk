---
status: accepted
open: B572
decided: 2026-11-17
source: doc-agent session 2026-11-17 (evening), the human on the product studio headless shot
---

# The shot harness gives every product view what the app gives it

The headless live shot timed out with an empty body for product studio twice (the B557 fill and the canvas-frames
slice); studio-lab and sdk shoot fine. Without the shot no agent can check what it builds in Studio. No open rebuild
group owned it, and a new group is the human's decision. The doc agent asked whether the broken Studio shot gets its
own group with a real repair, not a one-off patch. The human answered "ok".

- New rebuild group B572: the shot harness builds a product view on the same path the app does, so no second list of
  what a view needs can drift. The product studio shot is its first case.
- Suspect, not cause: the studio product view needs something the `withStudio` harness does not give it. The builder
  proves the cause with a bite before the fix.
- Done when product studio shoots headless on Linux and a spec fails if a product view gets less from the harness than
  from the app.
