---
'@ethlete/cli': patch
---

`design compare` no longer keeps an action result whose check failed at a harness error such as a timeout, so the next run presses the action again. With `--state` the action check covers only the selected states.
