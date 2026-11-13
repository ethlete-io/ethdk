---
status: accepted
built: a033f9de1
decided: 2026-11-13
source: doc agent chat 2026-11-13, afternoon (A36 remainder)
---

# A nested part is worked out from use

The part tree shows a part under another part when exactly one part of the same layer uses it. Nothing declares the
nesting: no host folder, no new key, no check rule that refuses a use outside the host. Today this nests only
`components/title-search` under `components/title-bar`. A part with one user in another layer stays in its own layer, and a base part from the SDK never nests. A
part that gains a second user moves back to its layer.

The human chose this over a declared host folder with a check rule (answer "q1ok" to the recommendation). The look was
already decided by the merged `elements/part-tree@parts-only` variant a.
