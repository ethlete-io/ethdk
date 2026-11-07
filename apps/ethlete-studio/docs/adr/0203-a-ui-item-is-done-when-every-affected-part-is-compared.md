---
status: accepted
built: c32d82b03
decided: 2026-11-06
source: grill session 2026-11-06
---

# A UI item is done when every affected part is compared

A1 (the title bar) was committed as built, but it changed files of eight implemented parts that nobody compared; only
the pre-push gate found it, and three pages then showed 21-31 px DIFFs in every state (finding 491). A UI item is done
when it shows in the app and every part it affects is compared and verified. The commit check refuses a commit that
leaves an implemented part uncompared and names the parts. `design compare --affected` compares every affected part in
one run on one harness. The tool builder builds it right after the running performance step. Tom: "q3ok" (option a,
recommended).
