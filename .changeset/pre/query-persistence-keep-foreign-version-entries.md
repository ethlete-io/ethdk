---
'@ethlete/query': patch
---

Query persistence: entries written under another `version` are ignored instead of deleted, so two tabs on either side of a deploy no longer wipe each other's store; they are removed once past `maxAge`.
