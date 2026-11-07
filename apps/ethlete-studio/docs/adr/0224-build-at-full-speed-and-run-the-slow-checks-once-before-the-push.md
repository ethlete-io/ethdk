---
status: accepted
open: B418
decided: 2026-11-07
source: doc-agent session, after the builder hung for 9 h on a restart
---

# Build at full speed and run the slow checks once before the push

Tom: "Maximale parallel Arbeit ab JETZT SOFORT", then "Wir bauen nun. Verifiziert wird nur wenn es schnell geht. Wir
können nicht auf minutenlange Checks warten jetzt. Vollgas", and "Die Liste ist lang. GO" on the summary.

Until Tom revokes it, the builder works the queue with as many parallel agents as there are independent items, each in
its own worktree. This replaces the "no parallel compare or render agents" rule of ADR 0223. A check runs only when it
takes seconds: one spec file, lint of one file, a type check of one project. Full spec runs, full builds, Storybook and
Studio compares, and the low-load hook measurement of finding 557 wait. Commits still go through the git hooks. The
builder keeps a list of the checks it skipped per commit, and all of them run once over the unpushed range before the
next push of `next`.

Applied by the doc agent (2026-11-07): the slow checks in the pre-commit hook (design gate, sketch-round gate, specs,
lint, type check) leave the hook as ADR 0036, 0037 and 0038 already decided; they are rules in Studio and in CI.
