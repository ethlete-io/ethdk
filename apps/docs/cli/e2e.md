# E2E failure reporter

`@ethlete/cli` ships a Playwright reporter that writes each failed test to a JSON-lines file while the run goes on. A long e2e run then has a readable failure list before it ends, and an agent can group the failures by error text instead of parsing the console log.

It needs `@playwright/test` in the app. The CLI declares it as an optional peer dependency.

## Setup

Add the reporter next to the one you read in the terminal:

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['list'], ['@ethlete/cli/playwright/failure-reporter']],
});
```

Add the file to `.gitignore`:

```
e2e-failures.jsonl
```

## Where the file goes

The first match wins:

| Source                               | Example                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| The `E2E_FAILURES_FILE` env variable | `E2E_FAILURES_FILE=tmp/slice-a.jsonl npx playwright test`                            |
| The `outputFile` option              | `['@ethlete/cli/playwright/failure-reporter', { outputFile: 'tmp/failures.jsonl' }]` |
| The default                          | `e2e-failures.jsonl` next to `playwright.config.ts`                                  |

A relative path resolves against the directory of the config file. The reporter empties the file at the start of each run.

Keep the file outside the `outputDir` of every project (`test-results` by default). Playwright deletes that folder at the start of a run. If the path is inside it, the reporter prints a warning.

## One line per failed attempt

A test that fails, times out or is interrupted gets one line per attempt, so a test with `retries: 1` that fails twice gets two lines. A test that fails as expected (`test.fail()`) and a skipped test get none.

```json
{
  "test": "checkout > pays with a saved card",
  "location": "e2e/src/checkout/pay.spec.ts:42",
  "project": "chromium",
  "status": "failed",
  "retry": 0,
  "seconds": 7,
  "error": "Error: expect(locator).toBeVisible() failed\n...",
  "context": "/abs/path/test-results/checkout-pay-chromium/error-context.md"
}
```

| Field      | Value                                                                                |
| ---------- | ------------------------------------------------------------------------------------ |
| `test`     | The describe blocks and the test title, joined with `>`. Without project and file.   |
| `location` | `file:line`, relative to the directory Playwright runs in.                           |
| `project`  | The Playwright project name, or `null` without one.                                  |
| `status`   | `failed`, `timedOut` or `interrupted`.                                               |
| `retry`    | The attempt, `0` for the first one.                                                  |
| `seconds`  | The duration of the attempt, rounded.                                                |
| `error`    | The first 6 lines of the error message, without color codes, at most 700 characters. |
| `context`  | The path of Playwright's `error-context.md` attachment, or `null`.                   |
