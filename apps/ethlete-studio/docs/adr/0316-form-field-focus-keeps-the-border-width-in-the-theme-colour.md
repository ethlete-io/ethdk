---
status: accepted
open: B533
decided: 2026-11-16
source: doc-agent session 2026-11-16, screenshot of the focused input in the B532 state sheet; supersedes ADR 0160 and ADR 0162
---

# Form field focus keeps the border width in the theme colour

A focused text field draws its frame 2px wide in the surface text colour (ADR 0160), so the frame turns thick and
white. The human, on a screenshot of it: "bei focus soll der border nicht fett werden. er soll die theme color bekommen
wie früher dann einfach."

On focus the form field frame keeps its resting border width and only changes its colour to the theme colour, as it
did before ADR 0160. This holds for editable and readonly fields alike.
