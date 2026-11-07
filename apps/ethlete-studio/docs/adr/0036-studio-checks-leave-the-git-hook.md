---
status: accepted
open: B295
governs: ['.husky/*', 'tools/scripts/*gate*']
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Solo focus, sketch view, behavior tests and pre-push decisions", Studio checks
---

# Studio checks leave the git hook

Tom: "we built a check system in Studio, why rely on git hooks". The four Studio gates in `.husky/pre-push` (studio
specs, static design check of reached parts, live check of regions no part covers, visible-change gate) become rules
of Studio's check system; their hits show as problems on the part.
