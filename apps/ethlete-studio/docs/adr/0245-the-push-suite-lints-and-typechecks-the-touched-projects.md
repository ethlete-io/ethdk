---
status: accepted
built: 9a2573e21
governs: ['tools/scripts/push-suite.mjs']
decided: 2026-11-10
source: grill session 2026-11-10 (Mac night shift, morning round), findings 687 and 688
---

# The push suite lints and typechecks the touched projects

Two slices of the night went in with type errors and no local check showed it: pre-commit and pre-push run no
typecheck (ADR 0038), and the draft pull request per slice of ADR 0216 is not built. `yarn push:suite` now runs lint
(since cef57a3d0) and typecheck for the projects that the pushed range touches, once per push. A failure blocks the push
verdict. This narrows ADR 0038 for the push suite only; pre-commit and pre-push stay as ADR 0038 says. Rejected: a draft
pull request per slice also at night, and both. The human: "q3ok".
