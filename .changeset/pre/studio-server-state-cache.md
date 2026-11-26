---
'ethlete-studio': patch
---

Polling a design server Studio did not start judges it stale once per server start instead of on every poll, and sends its log only when it changed.
