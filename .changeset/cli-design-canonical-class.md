---
'@ethlete/cli': minor
---

`et design check` now fails with `CANONICAL-CLASS` when a Tailwind class in a design part has a shorter canonical form, for example `w-[420px]` that can be written as `w-2xl`.
