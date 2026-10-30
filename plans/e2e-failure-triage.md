# E2E failure triage: port from fifagg-frontend

Source: the fifagg session `fifagg-frontend-d4`, `/home/tom/dev/fifagg/fifagg-frontend`, branch
`chore/post-angular-22-cleanup`, commit `4114f85b9e`. The files there are `apps/e2e/tools/failure-reporter.ts`
and `apps/e2e/tools/run-slices.mjs`.

Gate: start slice 1 only after `fifagg-frontend-d4` confirms that both tools worked in a real e2e run.
On 2026-10-30, nobody ran them live.

Done already: the Angular 22 `?.` note in the `sdk-update` skill (`9f86816bf`).

Not portable, and out of scope: `run-full.sh` (PHP-FPM, profiler), `affected.mjs` and `specs.mjs` (the
spec format of that repo), and `webkit-host-libs.sh`.

## Slice 1: failure reporter

A Playwright reporter. For each failed test, it appends one JSONL line at the time of the failure.
The output path comes from `E2E_FAILURES_FILE`.

- Line shape: `{ title, file, line, project, retry, error }`. `error` holds the first lines of the
  error message. Fix the shape here, because slices 3 and 4 read it.
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
- Exit code: 1 if one slice failed.
- Changeset: the same `@ethlete/cli` minor.

## Slice 3: `e2e-triage` skill

A consumer skill in `libs/agent-rules/content/skills/e2e-triage/`, `scope: consumer`,
`requires: ['@ethlete/cli']`. Steps: read the JSONL files, group the lines by the normalized error
text, then look at the largest group first. One root cause often fails many tests. Normalize the error
text: remove line numbers, timeouts and ids before grouping. The skill tells how. If a script does the
grouping better, add `et e2e triage` to slice 2 instead.

- Changeset: `@ethlete/agent-rules` minor. Then run `yarn agents:sync`.

## Slice 4: the `e2e-progress` mod

The mod is in `tom-mods` (installed copy: `~/.claude/plugins/cache/tom-mods/e2e-progress/0.1.1`), not
in this repo. Change it to read the JSONL lines and stop parsing the `list` reporter log. Keep the log
parser as a fallback while a repo has no reporter. This slice is outside the SDK. Do it in the
`tom-mods` source repository.

## Decisions

Tom agreed on 2026-10-30:

- Slice 1 home: `@ethlete/cli/playwright`, not a new package.
- Slice 3: skill prose first. Add `et e2e triage` only if agents group badly by hand.
