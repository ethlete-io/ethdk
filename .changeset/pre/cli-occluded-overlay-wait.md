---
'@ethlete/cli': patch
---

`design compare --live` fails a state as OCCLUDED when a shell panel covers a design frame (opt out per live state with `"occluded": true`), and waits for overlay panes to end their enter animation before each shot.
