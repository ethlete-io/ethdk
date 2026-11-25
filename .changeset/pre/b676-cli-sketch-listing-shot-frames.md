---
'@ethlete/cli': patch
---

The design server's sketch listing sends `shotFrames`, the size of each target shot's picture kept on disk, so a client can size its cells before a shot loads. Reading them draws nothing.
