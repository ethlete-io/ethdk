---
status: accepted
built: a5a004199
decided: 2026-10-27
source: the design system model plan (deleted in B597, ADR 0365), "Slice 1 decisions (2026-10-27)"
---

# A product names its base by path; @ethlete/components is built in

`base` is a path to another product folder whose settings come from the `config.json` of the workspace that holds
it. `@ethlete/components` is a built-in base: the SDK system that ships in `@ethlete/cli`.
