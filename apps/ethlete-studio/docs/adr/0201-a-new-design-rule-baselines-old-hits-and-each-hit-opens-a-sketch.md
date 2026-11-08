---
status: accepted
governs: ['libs/cli/src/lib/design/system/*']
open: B401
decided: 2026-11-06
source: grill session 2026-11-06
---

# A new design rule baselines old hits, and each hit opens a sketch

The CONTROL-STATE rule (4f1ba2b3e) landed on two hand-drawn rail buttons in `shell-main` that predate it, and no gate
ran the draw rules (finding 489). The commit that adds a design rule runs it over every product. Hits on existing parts
go into a baseline list for that rule: the rule fails at once for new code, the baseline may only shrink, and each
baselined hit becomes a finding that opens a sketch for its fix. The draw rules (CONTROL-STATE, DROPPED-PROP,
ACTION-LOST) join the `--slow` set with the per-part input-hash cache. Tom: "q1ok" (option b, recommended).
