---
'@ethlete/cli': patch
---

The render check reads the unstyled pass once per page load instead of once per colour scheme, and inspects a frame in the same call that waits for it to settle.
