---
'@ethlete/core': minor
---

`createSwipeTracker` now reports the release velocity — measured over the trailing
100ms of the gesture (`SWIPE_VELOCITY_WINDOW_MS`) — in `pixelPerSecondX/Y` instead
of the whole-gesture average. A slow drag ending in a flick reports the flick, and a
flick parked before release reports ~0.
