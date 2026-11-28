---
'@ethlete/cli': patch
---

Update Vite to 8.4.0, which frees a closed design server, so the design server's slow-check worker no longer grows by about 380 MB per check run.
