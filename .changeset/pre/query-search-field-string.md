---
'@ethlete/query': major
---

**Breaking:** `searchQueryField()` is typed `string` and starts at `''` instead of `null`, so `[formField]` binds it to `<et-input>` under `strictTemplates`; write `''` where you wrote `search: null`.
