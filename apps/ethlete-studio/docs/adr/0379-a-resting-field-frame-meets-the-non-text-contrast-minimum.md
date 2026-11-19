---
status: accepted
open: B633
decided: 2026-11-19
amends: 0163
source: doc-agent session 2026-11-19, screenshot of the Timetrack row editor in dark mode
---

# A resting field frame meets the non-text contrast minimum

The resting frame of an input and textarea was set to 4.74:1 (light) and 6.94:1 (dark) against its surface. In dark
mode that draws every field frame near white. The human, on a screenshot of the Timetrack row editor: "dass die border
der inputs nun knallweiß sind" and "das muss durch irgendeine blöde aaa regel gekommen sein von studio".

The resting frame of a text field targets the non-text contrast minimum, about 3:1 against its surface, in light and
dark. It is the SDK default for every app; no app overrides it. Hover still lightens the frame, focus keeps the theme
colour at the same width (ADR 0316), readonly keeps its dashed frame. Input and textarea still share one value.
