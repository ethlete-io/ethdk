---
status: accepted
open: B578
decided: 2026-11-17
source: doc-agent session 2026-11-17 (late evening), the human on the studio menu rows
---

# Studio menu rows without a target stay hidden

Since 5d391eb88 the studio menu's appearance radios and help rows (settings, shortcuts, help, about) are enabled and
emit, but nothing acts on them: no light theme, no dialogs. The doc agent recommended hiding them; the human answered
"ok".

- A studio menu row whose action has no target is hidden, in the design and in the app, until a row builds its target.
- A row that gains a target shows again in the same slice that builds the target.
