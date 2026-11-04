---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Solo focus, sketch view, behavior tests and pre-push decisions", pre-push keeps
---

# Pre-push keeps only fast checks that prevent a certain CI failure

Pre-push runs format, changesets and the VitePress build when apps/docs changes. Lint and typecheck move to CI only;
no throwaway clone for them.
