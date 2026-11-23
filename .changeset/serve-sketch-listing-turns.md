---
'@ethlete/cli': patch
---

The design server builds each sketch of a listing answer in its own event loop turn, so a listing of many sketches no longer blocks other requests.
