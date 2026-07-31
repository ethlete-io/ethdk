---
'@ethlete/components': minor
---

Pagination: add `<et-page-size-select>` (`PAGE_SIZE_SELECT_IMPORTS`) — the "Items per page" control
that completes the Material-style controls row beside a compact paginator. A native `<select>`, so it
pulls in nothing; a separate component, because page size is the app's state rather than the
paginator's. Changing the size deliberately does not reset the page. Two new label keys, `pageSize`
and `pageSizeOption`.
