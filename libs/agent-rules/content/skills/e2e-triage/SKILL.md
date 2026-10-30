---
name: e2e-triage
description: Work through a failed Playwright e2e run - read the failures file the @ethlete/cli failure reporter writes, group the failures by error, fix the largest group first, and re-run only the specs that failed. Read when an e2e run fails with more than a few tests, when an `e2e-failures.jsonl` file is present, or before you start a full e2e run after a change.
kind: skill
scope: consumer
requires: ['@ethlete/cli']
vars: [docsBaseUrl]
---

# Triage a failed e2e run

Many failed tests rarely mean many bugs. In one real run, a single change in a shared pipe failed 61
tests. After the fix, 158 of the first 159 retried tests passed. So find the shared cause first, and
never fix failures one test at a time from the top of the log.

## Before the run

1. Check that `playwright.config.ts` lists `@ethlete/cli/playwright/failure-reporter` in `reporter`.
   If not, add it next to the reporter that is there: `[['list'], ['@ethlete/cli/playwright/failure-reporter']]`.
   The reporter writes one JSON line per failed attempt while the run goes on. The guide is
   {%docsBaseUrl%}/cli/e2e.
2. Run the specs of the files you changed first. Start the full suite only when they pass. A full
   run takes long, and one broken shared file fails it everywhere.

## Read the failures

The file is `e2e-failures.jsonl` next to `playwright.config.ts`, unless `E2E_FAILURES_FILE` or the
`outputFile` option of the reporter names another path. You can read it while the run goes on.

Each line has `test`, `location`, `project`, `status`, `retry`, `seconds`, `error` and `context`.
`error` holds the first lines of the message. `context` is the path of Playwright's
`error-context.md`, which holds the page snapshot at the failure.

Do not parse the console log of the run. It mixes the output of parallel workers, and it has no end
line if the run stops.

## Group, then fix the largest group

1. Normalize the `error` text of each line. Remove line and column numbers, timeouts in ms, ids,
   hashes and dates. Keep the matcher, the locator and the expected value.
2. Group the lines by the normalized text. Count the distinct spec files per group, not only the lines.
   A group that spans many spec files points at shared code: a component, a pipe, a fixture or a
   test helper.
3. Take the largest group. Read one `context` file of it, then the code the error points at. Find
   one cause that explains the whole group.
4. Fix that cause. Then re-run only the spec files of that group.

Small groups that differ only in a locator often have the same cause. Check them after the large group
is fixed, because a fix often clears them too.

## Re-run only what failed

Take the spec file from `location`, without the `:line`. Collect each file once, then run:

```bash
npx playwright test <file> <file> --project=<project> --no-deps
```

- Pass each file as its own argument. In zsh, an unquoted `$files` is one argument, and Playwright
  then finds no tests.
- `--no-deps` skips the setup projects. Leave it out if the failure is in a setup project, or if the
  setup state is gone.
- `--project` comes from the `project` field. Run one call per project.

## Retries and flaky tests

With `retries` on, a test that fails each attempt has one line per attempt (`retry` 0, 1, and so on).
A test with a line for `retry` 0 and no line for the last retry passed on a later attempt: it is flaky.
Report a flaky test, but fix the stable failures first.

## Rules

- Never skip a failed test, or mark it with `test.fail()` or `test.fixme()`, to make a run pass.
- Never change an assertion to match the wrong value the app shows now. A failed e2e test is a
  signal first. If you think the test is wrong, say why, and ask before you change it.
- Report per group: the cause, the fix, the spec files you re-ran, and what still fails.
