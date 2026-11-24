# Lines for every subagent brief

Copy each line into every subagent brief.

- Wait with `run_in_background` or Monitor (with `description`), never a `pgrep -f`/`pkill -f` loop. A long run gets the Bash `timeout` parameter (max 600000 ms), never the shell `timeout`.
- A refused gate is a finding: stop and report it, never call its internals to pass it.
- Before your commit, run `npx vitest related --run <changed files>` in each touched vitest project dir, and `node --test <related specs>` for `tools/**`.
- A live measurement uses `yarn scratch:checkout <dir>`, never a `node_modules` link.
- A defect fix needs a test red without it on the reported real case (another fixture does not count) and a shot of that case after it. Without both: report "not fixed, Suspect", no `fix` commit.
- A change to a Studio view runs that view's e2e cases with `--case` (about 5 min max, in the background) before you report done. The full suite stays in CI.
