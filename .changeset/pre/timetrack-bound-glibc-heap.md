---
'timetrack-app': patch
---

The Linux host bounds the glibc heap it keeps resident: freed IPC bodies return to the system instead of staying in per-thread arenas.
