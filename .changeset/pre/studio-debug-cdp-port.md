---
'ethlete-studio': patch
---

Debug builds of Studio open the CEF remote debugging port named by `ETHLETE_STUDIO_CDP_PORT` and add the checkout named by `ETHLETE_STUDIO_OPEN_ROOT` to the roots at start. Release builds compile neither in.
