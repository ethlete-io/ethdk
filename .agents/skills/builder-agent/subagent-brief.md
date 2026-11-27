# Lines for every subagent brief

Copy each line into every subagent brief.

- Wait with `run_in_background` or Monitor (with `description`), never a `pgrep -f`/`pkill -f` loop. A long run gets the Bash `timeout` parameter (max 600000 ms), never the shell `timeout`.
- A refused gate is a finding: stop and report it, never call its internals to pass it.
- Before your commit, run `npx vitest related --run <changed files>` in each touched vitest project dir, and `node --test <related specs>` for `tools/**`.
- A live measurement uses `yarn scratch:checkout <dir>`, never a `node_modules` link.
- A defect fix needs a test red without it on the reported real case (another fixture does not count) and a shot of that case after it. Without both: report "not fixed, Suspect", no `fix` commit.
- A change to a Studio view runs that view's e2e cases with `--case` (about 5 min max, in the background) and `yarn studio:classes:check` (0 findings) before you report done. The full suite stays in CI.
- Before the handback, stop your background tasks with TaskStop, then run `yarn agents:stop-own`; never `kill` by hand.
- Run a design check with the CLI `design check --product <p> --part <part>`, never with the ethlete-design MCP tool.
- Run a code generator or migration with `--dry-run` first. If its file list holds a file outside your task, stop and report it.
- Wrap every heavy job (e2e, design check, build, full vitest) in `node /home/tom/dev/ethlete-sdk/tools/scripts/heavy.mjs run -- <cmd>` (light jobs - one part's design check, one spec file, one e2e `--case` - take no slot); Studio e2e runs with `--workers 2`. One hold lasts at most 15 min: split a longer run into chunks (`--case`), each chunk under its own `heavy.mjs run`. A long-running server (Storybook, `design serve`) never starts under the lock. Add `--movable` (after `run`) when the job needs no tank-only file (a dist, a running server) and leaves none you need: a loaded tank then sends it to rack or the Mac. Stop every process you started before the handback.
