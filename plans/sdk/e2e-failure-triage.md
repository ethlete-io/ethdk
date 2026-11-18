# E2E failure triage: the slice runner is open

Ported from fifagg-frontend (`apps/e2e/tools/run-slices.mjs`, fifagg session `fifagg-frontend-d4`). Built: the
failure reporter (`libs/cli/src/lib/playwright/failure-reporter.ts`, JSONL with `detail`), the `e2e-triage` consumer
skill and the `e2e-progress` mod in `libs/agent-rules/content/mods/`. Decided with the human on 2026-10-30: the reporter
lives in `@ethlete/cli/playwright`; the mod ships in `@ethlete/agent-rules`; the skill groups by hand first.

Not portable: `run-full.sh`, `affected.mjs`, `specs.mjs`, `webkit-host-libs.sh`.

## Open: `et e2e slices`

Runs one `playwright test` call per slice and writes one failures file per slice. At the end it prints a table: slice,
passed, failed, time.

- Input: `--slices a,b,c` or the folders under `--root e2e/src`. Everything after `--` goes to Playwright unchanged, as
  with `et api exec`.
- The skip-build switch of fifagg is that repo's environment variable. Do not encode it.
- Pass each spec path as its own argument to `spawn`, never joined into one string (zsh passes an unquoted `$files` as
  one argument and Playwright then finds no tests).
- A slice must be small: a `--max-failures <n>` default per slice (fifagg `shared` holds 992 tests).
- Exit code 1 if one slice failed.
- A health check of each `webServer` URL between slices, stop or restart on failure: in a 25-minute fifagg run the
  Contentful mock stopped and 10 of 14 failures were `ERR_CONNECTION_REFUSED`.
- Changeset: `@ethlete/cli` minor. Docs: `apps/docs/cli/`.

Done only the fifagg side: a live run of `yarn e2e:slices web-components` worked (exit 0, 1 passed).
