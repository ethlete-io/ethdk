---
'@ethlete/cli': patch
---

A sketch keeps its recorded baseline tree in the ref `refs/ethlete/sketch/<place>/<folder>`, so `git gc` no longer prunes it before `sketch rebase` ports from it. Discarding or merging the sketch deletes the ref.
