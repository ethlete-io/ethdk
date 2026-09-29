---
'@ethlete/query': patch
---

Legacy `[etInfinityQuery]`: `canLoadMore` stays `true` while the current page has failed or is retrying, so a trigger shown only when it is `true` can retry the first or last page.
