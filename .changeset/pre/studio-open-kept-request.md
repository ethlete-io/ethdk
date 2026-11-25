---
'@ethlete/cli': patch
'ethlete-studio': patch
'@ethlete/agent-rules': patch
---

`et design studio open` keeps its request when Studio is not running and exits 3 (queued); Studio adds the checkout at its next start and drops requests older than 7 days or whose checkout lost its design config.
