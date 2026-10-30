---
'@ethlete/cli': patch
---

A design frame retries a failed part import twice after a short back-off, so a part file that changes while its grid loads no longer leaves "Failed to fetch dynamically imported module" in the frame.
