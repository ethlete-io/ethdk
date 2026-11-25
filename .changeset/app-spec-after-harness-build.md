---
'@ethlete/cli': patch
---

The APP-SPEC check runs after the harness app's build and compare instead of beside them, so the memory peak of a design check no longer adds the vitest run to the build.
