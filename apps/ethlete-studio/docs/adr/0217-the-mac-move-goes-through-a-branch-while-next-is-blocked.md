---
status: accepted
open: B416
decided: 2026-11-06
source: doc-agent session 2026-11-06, after finding 541
---

# The Mac move goes through a branch while `next` is blocked

Tom wants the work moved to the Mac so this PC is free. The push of `next` (264 commits) is refused by the design gate:
pages/sketches, pages/system and pages/merge differ from their designs, pages/inventory and pages/start need a check
record (finding 541). The state goes to the branch `studio-mac-move` instead (ADR 0216); if the hook refuses that too,
the branch is pushed without the hook, since no publish runs from it. The Mac sessions work on that branch; the
builder there fixes the three parts first and then pushes `next` with the hook. Rejected: pushing `next` without the
hook (red design CI on `next`) and staying on this PC until the fix. Tom: "ok" (option b, recommended).
