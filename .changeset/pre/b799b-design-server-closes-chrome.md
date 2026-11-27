---
'@ethlete/cli': patch
---

The design server now closes every shared headless Chromium when it stops or reloads, even while a shot holds a lease, and its status log reports live, zombie, root and orphan Chrome processes.
