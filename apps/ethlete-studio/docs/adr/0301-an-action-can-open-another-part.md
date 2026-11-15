---
status: accepted
open: B502
decided: 2026-11-15
source: doc-agent session 2026-11-15, morning round after the night shift
---

# An action can open another part

"Search in Studio" opens the command palette, but no action form could say so, so its control had no `data-et-action`.
Asked whether to add an action form `opens:<part>` (for example `opens:command-palette`), with a page state "palette
open" as the alternative, and the recommendation yes, the human answered "q5ok".

The action grammar gets `opens:<part>`. The action names the part it opens; no extra page state is needed for it.
