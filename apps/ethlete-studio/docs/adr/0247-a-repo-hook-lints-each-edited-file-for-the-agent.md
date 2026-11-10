---
status: accepted
open: B476
decided: 2026-11-10
source: grill session 2026-11-10 (morning round), after ADR 0246
---

# A repo hook lints each edited file for the agent

ESLint ran for an agent only at commit (finding 685), so a lint error showed up after several files had changed. A
hook in the repo now runs ESLint on each `.ts`, `.mjs` or `.js` file under `libs/` or `apps/` right after an agent
edits it, with the same config and project directory as `nx lint` (the logic of `tools/scripts/lint-staged-files.mjs`),
and returns the errors to the agent. The cost per edit is measured with a deliberate error before it ships. Rejected: a
custom plugin with the ESLint language server, and only the commit hook. The human asked "gibt's das dann auch für
eslint?" and answered "5ok".
