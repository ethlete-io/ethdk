---
'@ethlete/cli': patch
---

`checks.skip` of a part now applies per sketch variant, so one variant's skip no longer decides for the others. A drawn element can opt out of a render check with `data-et-skip="CLIPPED"`, and a scaffolded part draws its name instead of an empty box that fails `design check` as ZERO-SIZE.
