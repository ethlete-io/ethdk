---
'@ethlete/cli': patch
---

`design serve` shares one in-flight rules run per product and ends it when the last caller aborts; a self-started resident idles out after `ETHLETE_DESIGN_IDLE_MS` (30 min by default), a serve-hosted one ends with its server.
