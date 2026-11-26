---
'ethlete-studio': patch
---

In a dev build, the design server line reads `stale` when the `libs/cli` source is newer than the built cli runtime, or a source file was deleted. A restart rebuilds it.
