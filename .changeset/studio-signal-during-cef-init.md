---
'ethlete-studio': patch
---

End the host through its exit path on SIGINT, SIGTERM or SIGHUP that arrives while CEF starts, instead of dying without stopping its processes or ignoring the signal
