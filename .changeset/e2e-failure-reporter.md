---
'@ethlete/cli': minor
---

Add `@ethlete/cli/playwright/failure-reporter`, a Playwright reporter that appends one JSON line per failed test attempt to `e2e-failures.jsonl` while the run goes on. `E2E_FAILURES_FILE` or the `outputFile` option changes the path.
