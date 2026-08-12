# @ethlete/timetrack

## 0.1.0-next.2

### Minor Changes

- [`eed8060`](https://github.com/ethlete-io/ethdk/commit/eed80604a2b9b5a2e68fec3b7f56f02060021388) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the day-review layer: `reviewDay()` applies a day's local edits over a freshly correlated day, so
  re-correlating never discards a row a reviewer has already touched.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`0fcbab9`](https://github.com/ethlete-io/ethdk/commit/0fcbab92b0da0061ce2d5fcea411ebba0b293d80) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Google Calendar provider and `matchMeetings()`, which turns an accepted event whose conference
  a window title names into a worklog row of its own.

## 0.1.0-next.1

### Minor Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`3b21416`](https://github.com/ethlete-io/ethdk/commit/3b21416847c982e75d9a0b1ba573752cbc68f470) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `collectAgentSessions$()` and the `AgentSessionLogReader` port, which read each agent session log
  from a persisted cursor so a run collects only what was appended since the last one.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`b39d77c`](https://github.com/ethlete-io/ethdk/commit/b39d77c350735b4ec158869ff238ac9e076ae105) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `parseClaudeCodeSessionLog()`, which reads a Claude Code session log into sampled agent-session
  events from its metadata alone.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`f9ce4c1`](https://github.com/ethlete-io/ethdk/commit/f9ce4c183c4470f43a96344f79bd088c6bd277f8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `collectGitEvents$()`, which reads a day's branch switches and commits out of the configured
  repositories.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`1d9cc7c`](https://github.com/ethlete-io/ethdk/commit/1d9cc7cae054e8ceedbaad044c500655e7198d20) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the store's core half: the event and ledger persistence ports, `applyExclusionRules()` with
  shipped defaults, `planRetention()` clamped to what compaction has covered, and
  `applyLedgerChanges$()`. `TimetrackEventStore` moved from `transport` to `store`.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`8d0777d`](https://github.com/ethlete-io/ethdk/commit/8d0777d60c25198db8b2ce7d90d18109a962d56c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Tempo write half: `executeTempoSync$()` applies a `TempoSyncPlan` with per-row results and a
  retryable remainder, plus worklog create/update/delete and a configurable ownership marker that
  survives a lost ledger.

## 0.1.0-next.0

### Minor Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`bc17623`](https://github.com/ethlete-io/ethdk/commit/bc17623d34aaabdf9cb26d89674a71d4ca3f2a41) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `@ethlete/timetrack`: the time-tracking core's data model, host ports, and the `sessionize()`
  and `attribute()` correlation steps that turn observed activity into issue-attributed blocks.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`a4739ec`](https://github.com/ethlete-io/ethdk/commit/a4739ec1eb923c89585d3998c2084cec802a1945) Thanks [@github-actions](https://github.com/apps/github-actions)! - Complete the deterministic pipeline with `mergeBlocks()`, `roundDurations()`, `checkDay()`,
  `describeWork()`, `propose()` and `correlateDay()` — a window of events now becomes rounded,
  described `WorklogProposal`s carrying their evidence chain.

- [`154c5cf`](https://github.com/ethlete-io/ethdk/commit/154c5cf65ebeb9627437fb50197c08d3839646fe) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the Jira provider over `TimetrackTransport` — issue lookup, the cursor-paged JQL search and
  hierarchy discovery — plus the merge-request/issue-view and recurring-pattern rungs of the
  attribution ladder.

- [`cce0cba`](https://github.com/ethlete-io/ethdk/commit/cce0cba53ec1fbb3fb7b312cee5f5891e92f0815) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the Tempo read side: work-attribute discovery, a paged worklog reader, `subtractForeignTime()`
  so a re-sync cannot log an hour twice, and `planTempoSync()` for the create/update/delete preview.
