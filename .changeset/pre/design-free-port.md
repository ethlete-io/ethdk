---
'@ethlete/cli': patch
---

`et design shot` and the render check take a free port even when 5173 is busy. Vite read port 0 as unset.
