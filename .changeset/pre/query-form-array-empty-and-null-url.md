---
'@ethlete/query': patch
---

Query forms: an array field with a non-null default now survives a reload holding an empty list or `null`, instead of restoring its default or `['ET_NULL__']`.
