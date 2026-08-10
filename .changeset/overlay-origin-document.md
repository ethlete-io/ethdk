---
'@ethlete/core': minor
---

The overlay runtime mounts into the document of the overlay's origin element: the runtime root, close listeners and all focus handling follow a new optional `document` in the mount config, with one runtime root kept per document. An overlay anchored inside a same-origin pop-up window now opens in that window.
