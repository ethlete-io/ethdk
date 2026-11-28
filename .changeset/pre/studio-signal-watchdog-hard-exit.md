---
'ethlete-studio': patch
---

End the host within two seconds of SIGINT, SIGTERM or SIGHUP when its shutdown stalls, and skip the exit handlers in that path so a running CEF shutdown cannot hold the process
