---
'timetrack-app': patch
---

Timetrack advertises itself on the LAN over mDNS, lists the machines it finds with `peers.discovered`, lets `pair.accept` take a discovered `machineId`, and keeps a paired machine's address current.
