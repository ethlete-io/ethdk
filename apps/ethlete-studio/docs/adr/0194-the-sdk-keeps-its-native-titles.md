---
status: accepted
open: B372
decided: 2026-11-05
source: grill session 2026-11-05
---

# The SDK keeps its native titles; the tooltip swap was for Studio only

Finding 116 and row A8 asked for the SDK tooltip in Studio only: app templates and `.ethlete/design`, for example the
warning icon in the Studio tree view. The commits e73234f6e and 661ce4cca also replaced native `title` attributes in
`libs/components` (password input, scheduler, cascader, table, picture-in-picture toggle, and more). The overlay runtime
then grew several bundles by up to 23 KB. Both commits are reverted exactly; Studio keeps its tooltips, and the bundle
goldens need no update for them. Tom: "das war nie der plan [...] das war auf studio bezogen wie zb. hier das icon im
tree view".

Tom also noted that the SDK uses native `title` where an `aria-label` may fit ("nett zu wissen dass wir hässliche title
attr nutzen anstelle von aria label"). That check is row B381, after the MVP.
