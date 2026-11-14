---
'@ethlete/cli': patch
---

A design sketch merge now writes through a journal under the product lock: a merge killed half way is undone, or finished once its commit landed, by the next design command.
