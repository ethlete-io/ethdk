---
status: accepted
built: e2f2e92b7
decided: 2026-11-22
source: doc-agent session 2026-11-22 (afternoon), after the B480 Windows spike
---

# Studio ships CEF on Windows

The B480 spike on `rack` built the CEF release of Studio from `next`: 21 min end to end, installer 142 MiB, installed
455 MiB. The release smoke paints the frame pictures, but 0 live frames. The installer is signed (ADR 0389). The doc
agent recommended to switch Windows as macOS did (ADR 0249) and to track the live frames as their own row. The human
(German, verbatim): "q1ok".

The Windows release switches to CEF. Every platform now runs one engine for the live view, the picture and the check
(ADR 0242). Live frames that do not paint on Windows are row B664; the release switch is row B665.
