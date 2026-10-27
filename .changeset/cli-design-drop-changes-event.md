---
'@ethlete/cli': patch
---

The design server no longer sends the `changes` event on `/__design/comment-events`; the `parts` event already names every frame a change redraws.
