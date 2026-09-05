---
'@ethlete/query': patch
---

WebSockets: a frame that parses as JSON but carries no `room` string is now reported as malformed, instead of being dropped with no sign of it.
