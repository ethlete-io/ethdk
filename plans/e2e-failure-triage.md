# E2E failure triage: port from fifagg-frontend

Source: the fifagg session `fifagg-frontend-d4`, `/home/tom/dev/fifagg/fifagg-frontend`, branch
`chore/post-angular-22-cleanup`, commit `4114f85b9e`. The files there are `apps/e2e/tools/failure-reporter.ts`
and `apps/e2e/tools/run-slices.mjs`.

Status on 2026-10-30: slices 1 (`9b7617fc5`), 3 (`1ad54cb6c`) and 4 are done. Slice 4: the mod (0.1.2, not a git repo) reads the file named in the `[failure-reporter] Writing failures to` log line, and falls back to the log parser. It needs a `/plugin` reinstall. The slice runner
did not finish a live run. Slice 2 waits for a confirmation from `fifagg-frontend-d4`.

Done already: the Angular 22 `?.` note in the `sdk-update` skill (`9f86816bf`).

Not portable, and out of scope: `run-full.sh` (PHP-FPM, profiler), `affected.mjs` and `specs.mjs` (the
spec format of that repo), and `webkit-host-libs.sh`.

## Slice 1: failure reporter

A Playwright reporter. For each failed test, it appends one JSONL line at the time of the failure.
The output path comes from `E2E_FAILURES_FILE`.

- Line shape: keep the fifagg fields and add two. Fix the shape here, because slices 3 and 4 read it.
  - `test`: the `titlePath()` without its first 3 parts, joined with `" > "`.
  - `location`: `"<file>:<line>"`, relative to the repo root.
  - `status`, `seconds`.
  - `error`: the first 6 lines, ANSI codes removed, 700 characters maximum.
  - `context`: the path of the `error-context.md` attachment, or `null`. The live run filled it.
  - New: `project` (`test.parent.project()?.name`) and `retry` (`result.retry`).
- Playwright deletes `outputDir` at the start of a run. The live run lost `.last-run.json`. The
  default failures path must be outside `outputDir`, for example `<e2e root>/failures.jsonl`. Reject
  or warn for an `E2E_FAILURES_FILE` inside `outputDir`. Nobody tested if a file written in `onBegin`
  survives, so do not rely on it.
- Home: a `@ethlete/cli/playwright` entry point. The consumer config uses
  `reporter: [['list'], ['@ethlete/cli/playwright/failure-reporter']]`.
  `@playwright/test` is an optional peer dependency.
- Tests: a spec that feeds fake `TestCase` and `TestResult` objects and reads the file back.
- Docs: a short page under `apps/docs/cli/`.
- Changeset: `@ethlete/cli` minor.

## Slice 2: slice runner

`et e2e slices`. It runs one `playwright test` call per slice and writes one failures file per slice.
At the end, it prints a summary table: slice, passed, failed, time.

- Input: the slice list comes from `--slices a,b,c` or from the folders under a root (`--root e2e/src`).
  Everything after `--` goes to Playwright unchanged, the same as `et api exec`.
- The skip-build switch of fifagg is an environment variable of that repo. Do not encode it. The
  consumer passes it in the environment of the command.
- Pass each spec path as its own argument to `spawn`. Never join paths into one string. In zsh, an
  unquoted `$files` is one argument, and Playwright then finds no tests.
- A slice must be small, or the runner passes `--max-failures`. The fifagg `shared` folder holds 992
  tests, which is too big for one slice. Add a `--max-failures <n>` default per slice.
- Exit code: 1 if one slice failed.
- From the fifagg retry run (2026-10-30): the Contentful mock, a Playwright `webServer`, stopped in a
  25-minute run. 10 of 14 failures were `ERR_CONNECTION_REFUSED` on the mock port. Consider a health
  check of each `webServer` URL between slices, and stop or restart if it fails.
- The same run: a health-fixture failure has the first error line "Console errors or 5xx responses
  during the test", with no URL. Triage cannot group it. The reporter or the `e2e-triage` skill must
  get the first console error or URL line. The first 6 lines are the message, the `toEqual` header and
  the `- Expected` and `+ Received` counts. The URL comes in the `+ ` lines after them. Follow-up for
  the slice 1 reporter: add a `detail` field with the first error line past line 6 that holds `http`
  or starts with `+ `. Do not match on fixture messages. Slice 3 must also mark "connection refused on a mock" as
  an infrastructure group, not as a test verdict.
- Changeset: the same `@ethlete/cli` minor.

## Slice 3: `e2e-triage` skill

A consumer skill in `libs/agent-rules/content/skills/e2e-triage/`, `scope: consumer`,
`requires: ['@ethlete/cli']`. Steps: read the JSONL files, group the lines by the normalized error
text, then look at the largest group first. One root cause often fails many tests. Normalize the error
text: remove line numbers, timeouts and ids before grouping. The skill tells how. If a script does the
grouping better, add `et e2e triage` to slice 2 instead.

- Order of runs, from the fifagg run: one bug failed 61 tests, and after the fix 158 of the first 159
  retried tests passed. So the skill says:
  1. Run the specs of the changed files first (in fifagg: `yarn e2e:affected`).
  2. Fix the largest group.
  3. Re-run only the failed spec files with `--no-deps --project=<name>`, not the full suite.
- Changeset: `@ethlete/agent-rules` minor. Then run `yarn agents:sync`.

## Slice 4: the `e2e-progress` mod

The mod is in `tom-mods` (installed copy: `~/.claude/plugins/cache/tom-mods/e2e-progress/0.1.1`), not
in this repo. Change it to read the JSONL lines and stop parsing the `list` reporter log. Keep the log
parser as a fallback while a repo has no reporter. The fifagg session fixed the parser already: a run
is finished on an `N passed`, `N failed` or `N did not run` summary, or on an `EXIT n` line. Before,
a log with only failures never counted as finished. `/reload-plugins` dropped the local-scope install
of the mod, and a reinstall with `/plugin` was necessary. This slice is outside the SDK. Do it in the
`tom-mods` source repository.

## Slice 5: ship the mod in `@ethlete/agent-rules`

The mod is in `tools/claude-mods/` now (`d0ee7819b`). `/home/tom/dev/mods/e2e-mkt` is a symlink to it,
so the installed copy still works. Consumers have no source, so the package must carry it:

- Move `tools/claude-mods/plugins/e2e-progress` into `libs/agent-rules/content/` and publish it with
  the package. Rename the marketplace from `tom-mods` to `ethlete`.
- `ethlete-agents sync` writes `extraKnownMarketplaces` and `enabledPlugins` into the consumer's
  `.claude/settings.json`, with a path into `node_modules/@ethlete/agent-rules/`.
- Spike done (2026-10-30, Claude Code 2.1.314): it works. Write the path relative, for example
  `"path": "./node_modules/@ethlete/agent-rules/<dir>"` with `"source": "directory"`. The first
  interactive start after the folder trust registers the marketplace with the path resolved against the
  project root. The mod is then active with no prompt. `claude -p` does not register project
  marketplaces. `claude plugin marketplace add --scope project` writes an absolute path, so do not use it.
- Keep the mod version tied to the package version, because the mod reads the reporter's path line.
- Docs: `apps/docs/agent-rules/`. Changeset: `@ethlete/agent-rules` minor.

## Decisions

Tom agreed on 2026-10-30:

- Slice 1 home: `@ethlete/cli/playwright`, not a new package.
- Slice 5 (2026-10-30): ship the mod in `@ethlete/agent-rules`, not as a GitHub marketplace.
- Slice 3: skill prose first. Add `et e2e triage` only if agents group badly by hand.
