---
status: accepted
open: B576
decided: 2026-11-18
source: doc-agent session 2026-11-18, the human on the ready mark grain
---

# A ready mark keys on the files a part imports

The ready marks decision said a mark keys on what the part uses, not on a whole shared file. The builder's probes
(2026-11-18) found the cascade had two causes: most drops were correct (embedded parts had changed), and the whole
`ready.json` in the product inputs flipped every mark (fixed 869a8e2c5). What remains is file grain: an unused export
added to a shared file makes every importing part's mark stale (9 marks in one probe). Hashing per export is a large
change, and a missed dependency would keep a mark on a changed design. The doc agent recommended staying at file grain;
the human answered "ok".

- A ready mark keys on the files in the part's import graph, at whole-file grain. No per-export hashing.
- This replaces the item "a ready mark keys on what the part uses, not on a whole shared file" of the ready marks
  decision (0335).
