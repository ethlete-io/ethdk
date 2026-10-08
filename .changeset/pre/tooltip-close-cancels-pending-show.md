---
'@ethlete/components': patch
---

Closing a tooltip with Escape or `hide()` cancels a hover show still waiting for its delay, so the line chart tooltip no longer reopens after an early Escape.
