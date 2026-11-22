---
status: accepted
open: B666
decided: 2026-11-20
source: grill session 2026-11-20 (afternoon), B480
---

# The Windows installer is signed

The Windows CEF spike on `rack` proved the build, the live frames and the size (installer 141 MiB, installed 453 MiB).
Whether Windows blocks an unsigned installer could not be measured there: Smart App Control is off on `rack` and cannot
be turned on again without a reinstall. The doc agent proposed to treat signing as required instead of measuring on a
fresh Windows PC, since Smart App Control is on for most users. The human (German, verbatim): "q4ok".

The Windows Studio installer ships signed. The spike's signing point is closed by this decision, not by a measurement.
