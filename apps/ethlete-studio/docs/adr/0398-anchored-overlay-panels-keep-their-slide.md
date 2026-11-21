---
status: accepted
open: B664
decided: 2026-11-21
source: doc-agent session 2026-11-21 (evening), question when the slide animations went away
---

# Anchored overlay panels keep their slide

Anchored overlay panels (select, tooltip, toggletip, cascader, date picker) lost their slide on 2026-10-24/25
(b4b3d23c3, 54e9b8fe2) and have faded opacity only since, without a recorded decision. The human: "ne also das war
gewollt dass das gleiten und co bleibt".

- The panels get their slide-and-fade enter and leave back, as before b4b3d23c3.
- A fix that a slide got in the way of keeps its effect without dropping the slide.
