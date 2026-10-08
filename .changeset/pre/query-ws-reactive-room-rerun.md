---
'@ethlete/query': patch
---

Stop a reactive `joinRoom` from joining its room a second time when a signal it reads changes without changing the room name, which left the room joined after the consumer was destroyed.
