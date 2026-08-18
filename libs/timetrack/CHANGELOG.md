# @ethlete/timetrack

## 0.1.0-next.5

### Minor Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`5bd2f14`](https://github.com/ethlete-io/ethdk/commit/5bd2f14d27877c7db23c7fc878bb55bf5376bac4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent sessions: a cursor now records its checkout, so `resyncAgentSessionCursors()` can rewind the logs under a path and `agentSessionResyncOffers()` can name the skipped checkouts a new project link covers.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`3657156`](https://github.com/ethlete-io/ethdk/commit/36571560c755468459a87da9d9ec5764d976ee96) Thanks [@github-actions](https://github.com/apps/github-actions)! - `ethlete-agents timetrack instance` reports the Jira instance's own levels and the custom fields a
  branch subject could go in, so a setup step reads the answer instead of guessing it.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`8072455`](https://github.com/ethlete-io/ethdk/commit/8072455df2987b382e537e34a7810401bca01211) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent sessions are stored only for checkouts a project link covers, so work Tempo could never bill no
  longer fills the database.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`d73d386`](https://github.com/ethlete-io/ethdk/commit/d73d38685721714021f5e7ac86997506486770fc) Thanks [@github-actions](https://github.com/apps/github-actions)! - How long the window waits after you go idle before it locks is now a setting, `lockAfterIdleMs`,
  rather than a fixed minute.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`46e883b`](https://github.com/ethlete-io/ethdk/commit/46e883b8e814a79df5cc882955aaa225ffeac69f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Settings: add `lockWindow`, which says whether the app locks its window until the account password is given. Collection never stops for it.

### Patch Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`7465f4f`](https://github.com/ethlete-io/ethdk/commit/7465f4f095839a4d289e5ebf92f14818465c36aa) Thanks [@github-actions](https://github.com/apps/github-actions)! - A repository that donates its time no longer takes an issue key off a recurring Tempo pattern or a
  browser tab. The block stays unattributed, so the day places it beside the work it was done for.

## 0.1.0-next.4

### Minor Changes

- [`f132d0b`](https://github.com/ethlete-io/ethdk/commit/f132d0b64e322c5823c9f50adeedecf388c5aa65) Thanks [@TomTomB](https://github.com/TomTomB)! - A coding agent in any repository can ask the app about Jira over a loopback endpoint, so no checkout
  needs a token of its own.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`65147f8`](https://github.com/ethlete-io/ethdk/commit/65147f8f5bff8387f33061e811d34a09748e21f2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Reconstruct a day in a project that does not follow the branch grammar: attribution rules
  name a repository's or a branch's issue, and a repository with no tickets of its own donates
  its time to the work beside it.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`0adabf7`](https://github.com/ethlete-io/ethdk/commit/0adabf7541b3fcc31422710ebf60e60ff777c2e9) Thanks [@github-actions](https://github.com/apps/github-actions)! - A branch that names no issue can now be repaired from the day view, once a ticket is filed for it.

- [`55a5fb5`](https://github.com/ethlete-io/ethdk/commit/55a5fb55c72d76072d91a26ffd75575a1548e105) Thanks [@TomTomB](https://github.com/TomTomB)! - A day now counts the time Tempo already holds against its target, so a day logged by hand no longer reports itself as short.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`eab3cc4`](https://github.com/ethlete-io/ethdk/commit/eab3cc4b99704fdd847fab5b15d950c0625b864c) Thanks [@github-actions](https://github.com/apps/github-actions)! - The week view and the end-of-day reminder no longer call a day unfinished when Tempo already holds its
  time; a new `TimetrackCoverageStore` port keeps what the Sync preview read, so both still answer
  offline.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`dce484d`](https://github.com/ethlete-io/ethdk/commit/dce484d3d25069b4327f93fc4230a3668eead1b4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Editor heartbeats: a new `editor` source names the checkout, branch and directory being edited, and
  an `ingest` module carries the wire format a reporter posts to the app's local endpoint.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`8ceb0bd`](https://github.com/ethlete-io/ethdk/commit/8ceb0bd3782015662eb8fe1b5709eb55fba23fff) Thanks [@github-actions](https://github.com/apps/github-actions)! - Say when a day is not finished: `dayNudge()` words the one reminder a day gets, from what the local
  ledger says is still owed. `TimetrackSettings` gains a `nudge` field.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`dac26ff`](https://github.com/ethlete-io/ethdk/commit/dac26ff902c3c5683891a3d76b40d3e594d66a8f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Log a pause shorter than `gapFillMs` as the work around it, so the day stops coming up
  short of its target across a run of small idle gaps.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`f668325`](https://github.com/ethlete-io/ethdk/commit/f668325b2ee5885b03dd6bd703205d6ee9fd1e3d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Read GitLab merge-request activity: `collectGitLabEvents$` stores what you pushed, commented on and
  approved, and `mergeRequestActivity()` turns it into the issue behind the merge request's own branch —
  so reviewing somebody else's work reaches the Task being reviewed.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`c8045d4`](https://github.com/ethlete-io/ethdk/commit/c8045d46d11cb675e12a78d8ac05787163e5d065) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Google OAuth half the calendar provider was waiting on: the code exchange, the refresh, the
  revoke, and a token source that hands out an access token that is valid right now.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`59df547`](https://github.com/ethlete-io/ethdk/commit/59df54780d54e8044ecf8b3b3ecc7b5245f1ce09) Thanks [@github-actions](https://github.com/apps/github-actions)! - Correlate a hard pause: `pauseWindows()` reads the stretches collection was stopped for out
  of a day's events, and `correlateDay()` takes them as `pauses` so no row is billed for time
  nothing watched.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`ce9ca31`](https://github.com/ethlete-io/ethdk/commit/ce9ca31886c7f720a9ecd1320e87218d91c93335) Thanks [@github-actions](https://github.com/apps/github-actions)! - Own Tempo worklogs per day: the ledger port now reads `entriesForDay$(day)`, so a worklog whose
  proposal the day stopped producing is deleted instead of reading as somebody else's.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`d4ede59`](https://github.com/ethlete-io/ethdk/commit/d4ede598eb18cce86993988a6aa2459715f48e65) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `moveRowBoundary()`, which moves the instant two adjacent worklog rows meet at without changing
  the pair's total, so a split can be placed exactly rather than only halved.

- [`b70453e`](https://github.com/ethlete-io/ethdk/commit/b70453e774c19aa821ef7365520a0712c8105e3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Settings hold picked Jira projects (`favoriteProjects`) instead of typed key prefixes, an issue key
  in free text is only read against them, and a reviewer can now write, move and remove a row the
  collectors never saw.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`47df13d`](https://github.com/ethlete-io/ethdk/commit/47df13dcf26f65ac7539edf90033b884823e5fe2) Thanks [@github-actions](https://github.com/apps/github-actions)! - A path can now be linked to a Jira project or marked private, so a side project on the same machine proposes nothing and fills in no timesheet.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`7f62cbc`](https://github.com/ethlete-io/ethdk/commit/7f62cbca2ea6e2891a800c4edeb9a12f17a1d272) Thanks [@github-actions](https://github.com/apps/github-actions)! - A day review can now ask your own `claude` CLI what the work it could not name belongs to. The answer
  arrives as a `weak` suggestion with its reason attached, so nothing syncs unread.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`3b2b253`](https://github.com/ethlete-io/ethdk/commit/3b2b253e08c552ff0f4a67410e4dde3678a82418) Thanks [@github-actions](https://github.com/apps/github-actions)! - Work a day found that no issue covers can now be filed as a Jira ticket from the review, and the new
  key becomes the standing rule for that context.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`39c64e7`](https://github.com/ethlete-io/ethdk/commit/39c64e7262b9dbe20f33d28552d019853396b4a1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Read a week of days at once: `reviewWeek()` answers which days still owe something, from the same
  local ledger the end-of-day reminder reads. Adds `startOfWeekKey()`, `weekDayKeys()`,
  `shiftWeekKey()` and `describeDayReviewGap()`, which words a gap for every surface that reports one.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`840886b`](https://github.com/ethlete-io/ethdk/commit/840886b4d0f47cbab1ea3229ebc2ff550068f0b7) Thanks [@github-actions](https://github.com/apps/github-actions)! - A new Start view files a ticket, creates the branch the grammar names for it and opens a draft merge request.

### Patch Changes

- [`de287bc`](https://github.com/ethlete-io/ethdk/commit/de287bc48aef0daa96103614ae32ceb5eec03610) Thanks [@TomTomB](https://github.com/TomTomB)! - A day no longer counts an agent session that ran while the user was away, and a lone late sample no longer stretches the block before it.

- [`c60c430`](https://github.com/ethlete-io/ethdk/commit/c60c4301d218c740c198f21b0fa2d05d652c1f7a) Thanks [@TomTomB](https://github.com/TomTomB)! - New `currentAttribution`, which names the issue the work happening now would be logged on and how sure the day is of it.

- [`9e23593`](https://github.com/ethlete-io/ethdk/commit/9e23593b03f371d707efce92c47d39132ed66e32) Thanks [@TomTomB](https://github.com/TomTomB)! - A day no longer labels blocks `HEAD`, including events a collector already stored with that branch.

- [`f89ab22`](https://github.com/ethlete-io/ethdk/commit/f89ab22b87a07465683fab32161d98d98af6bc2e) Thanks [@TomTomB](https://github.com/TomTomB)! - A Claude Code session in a detached checkout no longer reports `HEAD` as its branch.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`68bf132`](https://github.com/ethlete-io/ethdk/commit/68bf1324db1a4c1c4b447941a2dec254352e31c9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tempo sync: time you logged in Tempo by hand now counts against the day, so a sync no longer writes
  a second copy of it.

- [`67f9d12`](https://github.com/ethlete-io/ethdk/commit/67f9d12e34b19c18ccb9b2b3b25a520c9f6c7d4e) Thanks [@TomTomB](https://github.com/TomTomB)! - A reasoning run now reports why it proposed nothing, so a failed run is no longer read as an answer.

- [`13e944c`](https://github.com/ethlete-io/ethdk/commit/13e944c95f33074908b2a359b97aefce4d5d7ba8) Thanks [@TomTomB](https://github.com/TomTomB)! - A new ticket now reads the instance's projects, leads its description with what the work says it was, and can have the local agent write both fields.

- [`46fe3fe`](https://github.com/ethlete-io/ethdk/commit/46fe3fe98abbcc0618aa6f06e911318d26f854e9) Thanks [@TomTomB](https://github.com/TomTomB)! - A ticket draft now suggests its parent, offers the open issues that may already track the work, and lets the agent pick both.

## 0.1.0-next.3

### Minor Changes

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`4d39606`](https://github.com/ethlete-io/ethdk/commit/4d396066840f10f124d0db53e2fc570a7b60f087) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `currentActivity`, which reads a day's events and blocks as one present-tense statement for a tray
  or status readout, reporting idle over a stale block.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`056feed`](https://github.com/ethlete-io/ethdk/commit/056feedd6b1498c426e4ea7b9c1a3909e43767d7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `dedupeKeyOf`, the identity a re-collected event is recognised by, so a git scan can re-read a
  window of history without appending the same commit or branch switch a second time.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`58fd1e4`](https://github.com/ethlete-io/ethdk/commit/58fd1e455981cb516e380d949138f0098ed86dbc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add timer runs — `TimerRun`, `matchTimerRuns` and `correlateDay`'s `timerRuns`. A run displaces the
  reconstruction underneath it, so a timed hour is never proposed twice.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`7715bf9`](https://github.com/ethlete-io/ethdk/commit/7715bf9bad85b5e3fc828fd28771eb93e589d965) Thanks [@github-actions](https://github.com/apps/github-actions)! - `sessionize` now follows the focused window's repository, so with several editor windows open on
  different checkouts a title naming one re-points the block instead of leaving it on the branch last
  committed to.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`49aa421`](https://github.com/ethlete-io/ethdk/commit/49aa421abe46ee3005e0c2b163a664caddffee26) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the settings layer — `TimetrackSettings`, `parseTimetrackSettings`, `effectiveExclusionRules` and
  the `TimetrackSettingsStore` port, plus `readJiraCredentials$`/`readTempoCredentials$` and `has$` and
  `delete$` on `TimetrackSecretStore`.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`a132fc8`](https://github.com/ethlete-io/ethdk/commit/a132fc861f997850977edf57ccc9911007816754) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the read-only half of a Tempo sync — `previewTempoSync$` resolves the account, the issue ids and
  the day's remote worklogs into a `TempoSyncPlan`, and `fetchJiraMyself$` reads the account id every
  Tempo call is scoped to.

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
