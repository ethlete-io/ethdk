---
status: accepted
built: fac6ef075
decided: 2026-11-11
source: grill session 2026-11-11 (morning round), finding 776
---

# The live frame focus fix runs in the next night shift

When the app remounts a live frame iframe (an address change, or an off-view frame dropped after 5 s), a keyboard user
probably loses the focus to a menu trigger. This was injected, not seen live. The fix keeps the focus on the frame
host and gets its own e2e case. It is a Studio bug, not a feature, so it runs in the next night shift; a builder first
reproduces it live. The human: "q2ok".
