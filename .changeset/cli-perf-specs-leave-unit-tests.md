---
'@ethlete/cli': none
---

The wall-time cli specs (merge and serve stall, render budgets) move to `*.perf.spec.ts`, run by `nx run cli:test-perf` in a non-blocking CI job that uploads their JSON measurements from `tmp/perf`.
