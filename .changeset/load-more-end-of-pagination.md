---
'@ethlete/components': patch
---

Load more now dead-ends properly when the response can't state the end exactly: a page that comes back
empty - or that repeats the previous page, which is what an API asked for a page past the end usually
serves - is dropped instead of appended, and `hasMore` turns off regardless of `toHasMore`. Affects
`selectOptionsFromQuery`, `selectOptionsFromV2Query` and both table rows adapters, so a load-more
control no longer survives one page too long or duplicates the tail of the list.
