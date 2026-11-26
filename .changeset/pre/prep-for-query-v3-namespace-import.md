---
'@ethlete/query': patch
---

`prep-for-query-v3` renames symbols and flattens `ExperimentalQuery` when they are reached through a namespace import such as `import * as q from '@ethlete/query'`.
