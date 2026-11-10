---
status: accepted
built: cd52e6675
decided: 2026-11-10
source: grill session 2026-11-10 (Mac night shift, morning round)
---

# Studio keeps the live frame cap and drops "only visible frames are live"

The idea was that Studio keeps only the iframes in the viewport live. A measurement on the Mac (b171f767f) showed that
the existing cap already keeps 6 live frames, all in view; one frame costs 1-2 MB of JS heap and about 0 % idle CPU, and
an emulation of visible-only frames changed the open time by less than the noise. The idea is dropped; it is no
day-shift feature. The human: "q2ok".
