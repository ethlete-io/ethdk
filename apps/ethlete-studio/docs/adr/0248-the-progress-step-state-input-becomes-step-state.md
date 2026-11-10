---
status: accepted
built: 9e7c567d0
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), after finding 689
---

# The progress step input `state` becomes `stepState`

`et-progress-step` had an input `state`, and `RouterLink` has an input `state` (the navigation history state). On the
documented `<a [routerLink] et-progress-step [state]="...">`, Angular binds the value to both: the strict template check
fails with TS2322, and the router gets a string such as `complete` as navigation state. The input is renamed to
`stepState`, a breaking change: fut-frontend, the docs guide, the story and a minor changeset change with it. Rejected:
an alias next to `state` (two names, and the trap stays) and an `$any(...)` in the story only (hides the defect). The
human answered "Ok" to the rename.
