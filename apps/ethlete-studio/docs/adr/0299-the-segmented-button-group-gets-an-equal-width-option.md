---
status: accepted
open: B511
decided: 2026-11-14
source: doc-agent session 2026-11-14, afternoon round on SDK bundle size
---

# The segmented button group gets an equal-width option

fifagg's Match Center makes every segment the same width by overriding the internal class
`.et-segmented-button-group-buttons` with Tailwind arbitrary variants. Asked whether the SDK should offer this, with the
recommendation yes, the human answered "q3ok".

`et-segmented-button-group` gets a public equal-width option (an input such as `stretch`, plus a token). fifagg then
drops its override of the internal class.
