---
'@ethlete/agent-rules': patch
---

`parseBranch` now reads a leading issue key from a deprecated spelling such as `dev-FIP-2721-subject`, so it returns the key and a rename suggestion that carries it.
