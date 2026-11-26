---
'@ethlete/core': patch
---

Animations: fix overlays getting stuck in the DOM in an invisible but click-blocking state when their leave transition never reported completion.

When several anchored overlays close at once (e.g. clicking an item inside a nested menu closes the whole menu tree), destroying an ancestor pane shifts the anchored position of a still-leaving descendant. The browser then cancels and restarts the running transition, so its end event arrives either flagged as cancelled or under a stale transition id - and the animated lifecycle waited forever for an event that could no longer arrive, leaving the pane orphaned at `opacity: 0` while still intercepting pointer events. The lifecycle now treats the transition as settled once no animation is running anymore, matching the fallback the interrupted-transition path already had, so the overlay is torn down reliably.
