---
'timetrack-app': patch
---

Ask the compositor for input idleness rather than session idleness. An idle inhibitor, such as a call
or a video, silenced the old request, so this machine collected no idle transition at all.
