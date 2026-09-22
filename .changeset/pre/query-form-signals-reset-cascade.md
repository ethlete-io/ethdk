---
'@ethlete/query': patch
---

`defineQueryForm`: `isResetBy` resets now cascade transitively, so changing `country` clears `league` **and** the `team` that depends on it, in one committed change.
