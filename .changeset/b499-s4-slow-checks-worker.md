---
'@ethlete/cli': patch
---

`et design serve` runs its slow checks in a worker, so a slow-checks poll no longer blocks its answers; Tailwind's class facts are kept on disk under `node_modules/.cache/ethlete-design/class-facts` and shared by every process and worker.
