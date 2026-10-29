---
'@ethlete/cli': patch
'ethlete-studio': patch
---

`sketch variant --round` stores why the running round lost in its own `lost` field instead of overwriting the round's note, and `--round-note` sets the new round's note so `sketch ready` accepts it.
