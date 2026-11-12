# Lines for every subagent brief

Copy each line into every subagent brief.

- Never wait with `pgrep -f`/`pkill -f` loops: the pattern matches the loop's own command line, so it never ends. Use `run_in_background` or Monitor.
- A refused gate is a finding: stop and report it, never call its internals to pass it.
- Before your commit, run `npx vitest related --run <changed files>` in the dir of each touched vitest project, and `node --test <related specs>` for `tools/**`.
- A live measurement on a copy of the checkout uses `yarn scratch:checkout <dir>` and never links into `node_modules`.
