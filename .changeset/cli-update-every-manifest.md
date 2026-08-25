---
'@ethlete/cli': minor
---

`et update` now writes the new range into every `package.json` in the repo, not only the root one, and refuses a dist tag that points at an older version than the repo is on.
