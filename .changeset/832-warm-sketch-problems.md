---
'@ethlete/cli': patch
---

The design server computes the open points with their sketch problems in the background at start and after each watched file change, and an open-points request waits for that run instead of starting its own.
