---
'@ethlete/cli': patch
---

The design server no longer reloads every frame page on each change. It signals a change to a drawn file outside the design folder on its event stream, as a `changes` event, so Studio can redraw the frames itself.
