---
'@ethlete/query': minor
---

GQL over POST sends `variables` as a JSON object, as the spec requires, instead of a JSON string. A server that relied on the string must accept the map. GET is unchanged.
