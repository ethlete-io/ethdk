---
'@ethlete/components': patch
---

The overlay scroll blocker unlocks `<html>` scrolling when its injector is destroyed, for example when an app is destroyed with a modal overlay open. Before, `<html>` kept `position: fixed`.
