---
status: accepted
built: 6fa237035
decided: 2026-11-21
source: doc-agent session 2026-11-21 (evening), question when the slide animations went away
---

# Anchored overlay panels keep their slide

Anchored overlay panels (select, tooltip, toggletip, cascader, date picker) lost their slide on 2026-10-24/25
(b4b3d23c3, 54e9b8fe2) and have faded opacity only since, without a recorded decision. The human: "ne also das war
gewollt dass das gleiten und co bleibt".

- The panels get their slide-and-fade enter and leave back, as before b4b3d23c3.
- A fix that a slide got in the way of keeps its effect without dropping the slide.

The human, on the suspicion that Studio capture problems caused the removal: "animationen nicht erlauben ist ja ne
quatsch lösung".

- A Studio or design-tool problem with motion is fixed in the tool (wait for or hold the animation), never by dropping
  or shortening the product's motion.
