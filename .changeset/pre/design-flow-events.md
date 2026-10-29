---
'@ethlete/cli': patch
'ethlete-studio': patch
---

The design server sends a `flows` event when a flow file changes, and Studio reads the flows again, so a flow edit shows without a server restart.
