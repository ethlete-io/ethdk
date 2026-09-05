---
'@ethlete/query': patch
---

GQL queries can declare a `rawResponse` envelope other than `{ data: … }`, and `transformResponse` is typed against the real envelope instead of the unwrapped response.
