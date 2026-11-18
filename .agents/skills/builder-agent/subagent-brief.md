# Lines for every subagent brief

Copy each line into every subagent brief.

- Wait with `run_in_background` or Monitor (always with `description`), never a `pgrep -f`/`pkill -f` loop: it matches itself. Give a long run a deadline with the Bash `timeout` parameter (max 600000 ms), never the shell `timeout`: macOS has none.
- A refused gate is a finding: stop and report it, never call its internals to pass it.
- Before your commit, run `npx vitest related --run <changed files>` in the dir of each touched vitest project, and `node --test <related specs>` for `tools/**`.
- A live measurement on a copy of the checkout uses `yarn scratch:checkout <dir>` and never links into `node_modules`.
