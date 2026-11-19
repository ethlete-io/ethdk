---
status: accepted
open: B640
decided: 2026-11-19
source: doc-agent session 2026-11-19, on a Timetrack screenshot of the row editor checkbox
---

# A control's border hovers in its label's colour

When a form control with a label (checkbox, radio, and every other SDK control with the same pattern) is hovered,
its border takes the same colour as the label's hover colour. Today the border and the label hover in two different
colours. The human: "der hover auf dem border ist im vergleich zum hover auf dem label in der farbe schon unschön. der
border sollte dann auch die farbe vom label bekommen", and asked to check all controls in the control-states story.

The colour comes from the theming tokens, never a hardcoded value. The same review fixes the rest border that turned
near-white on dark surfaces on 19.11.
