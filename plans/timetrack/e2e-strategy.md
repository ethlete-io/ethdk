# E2E for the app, and what it can honestly cover

Agreed with Tom on 2026-09-08. Read [`vertical-slices.md`](./vertical-slices.md) first: this plan
says how each slice proves itself.

Unit tests check a function. They cannot check that the day view shows the row, that the sync
preview subtracts what Tempo holds, or that a refusal refuses. Those are flows, and a flow needs
the app.

## What already exists, and is right

`apps/timetrack-e2e` is a Playwright project with 25 tests in 6 spec files. It serves the app on
port 4211 from `main.e2e.ts`, which replaces `HOST_PORTS` with `createFakePorts()`. There is no
Tauri, no network and no keychain in that run.

**The seam is already in the right place. Do not move it.** `fake-ports.ts` fakes
`transport.request$`, which is the HTTP port. So the real `jira/client.ts`, `tempo/client.ts` and
`gitlab/client.ts` all run, and only the wire is replaced. Jira and Tempo are mocked already, at
the one level where the mock still exercises the code that talks to them.

That is the foundation. The problem is not the seam. It is four things around it.

## The four things that stop it covering the flows

### 1. CI never runs it

Verified on 2026-09-08. `ci-pr.yml`, `ci-next.yml` and `ci-main.yml` run `typecheck`, `lint`,
`test` and `build` with `nx run-many`, then run `storybook-e2e` with Playwright directly. None of
the three mentions timetrack. `nx e2e timetrack-e2e` runs only when a person remembers to type it.

A suite nobody runs is documentation, not a safety net. **Fix this before writing one more test.**

And it had already rotted. I ran it on 2026-09-08: 23 passed, 2 failed, both in
`week-review.spec.ts`, both in the same `beforeEach`. The cause was not the test. Commit
`18114741c fix(components): Give every form control a way to be named` gave every form control an
`aria-label` input, and `worklog-row.component.ts` still wrote `[attr.aria-label]` on the
`et-checkbox` host. That attribute lands on the role-less wrapper, where neither Playwright nor a
screen reader reads it — which the directive's own doc comment says in as many words. So the app
shipped a checkbox with no accessible name, and the only thing that noticed was a suite nobody
ran. Fixed in the same session; the suite is 25 green in 16 seconds.

Read that failure twice. The app consumes `@ethlete/components`, and nothing in CI notices when a
change in the library breaks a flow in the app. That is the gap CI closes, and no amount of new
tests closes it instead.

### 2. The fake API has no state

`e2eRespond` in `world.ts` maps a URL to a canned body. A `POST /rest/api/3/issue` always answers
`ABC-9999`, and no later search lists it. A Tempo write is accepted and forgotten.

So no round trip can be asserted. That matters most exactly where the app is most dangerous:

- "Sync writes three worklogs, then a second sync writes nothing." That is the idempotence the
  `tempo/` module exists for, and it is a round trip.
- "Create a ticket, then the day names the new key." A round trip.
- "Repair a branch, then the merge request carries the key." A round trip.

The one piece of state today is `foreignMinutes`, read out of `localStorage`. It is a workaround,
and it is the proof that the need is real.

### 3. The fixture is a module constant

`e2eEvents()` returns one hard-coded morning. A test that needs a different day cannot ask for
one; it has to change a shared constant that every other test reads. That is why the suite has 25
tests and not 120. The cost of the twenty-sixth is a fixture edit that risks the other twenty-five.

### 4. `now` is the real clock

`e2eDay()` reads today's date. Every flow that turns on the time of day is therefore unwritable or
flaky: the end-of-day reminder, the tray readout, a running timer, "the hour that just finished"
in the add-entry panel, a day that is still in progress against one that is over.

## What e2e can never cover here

The Rust host is 6 746 lines. Playwright drives a browser page, and that page never loads the
Tauri host at all. Pretending otherwise is how a plan comes to claim "all flows covered" while the
riskiest code has none.

| Area                                                                      | Layer that covers it        |
| ------------------------------------------------------------------------- | --------------------------- |
| Every screen, every flow the webview drives, the provider clients         | `timetrack-e2e`             |
| SQLite schema and migration, pause, retention, compaction, log parse      | `cargo test` in `src-tauri` |
| Window lock and PAM, tray icon, widget window, decorations, idle notifier | Manual, and short           |

`TESTING.md` is 17 sections today because the second and third rows have no automated layer at
all. The plan below moves the first row wholesale into Playwright, adds the second, and leaves a
manual list of about five physical checks.

## The four changes, in order

### 1. Put the suite in CI

Add it to the three workflows beside the Storybook run. The app build for the e2e configuration is
cheap: no optimisation, no Tauri, no Rust. Do this first, and let it fail loudly if it fails.

### 2. A stateful fake backend

Replace `e2eRespond` with three small objects that hold state:

```ts
export type FakeBackend = {
  jira: FakeJira; // issues, projects, issue types, fields. `createIssue` really adds one.
  tempo: FakeTempo; // worklogs by issue and day. A write is readable afterwards.
  gitlab: FakeGitLab; // projects, branches, merge requests.
};

/** Routes one request into the fake backend. The only place a URL is matched. */
export const respond = (backend: FakeBackend, request: TimetrackRequest) => TimetrackResponse;
```

Three rules for it:

- **A write changes the state.** That is the whole point. `POST /issue` adds an issue that the next
  search returns.
- **The test can read the state back.** Expose the backend on `window` in the e2e entry only, so a
  spec can assert `tempo.worklogs.length === 3` without a UI readout to read it from. A flow that
  writes must be assertable at the wire, not only on screen.
- **It refuses like the real thing.** A 401, a 403 and a 429 are three flows the app has code for
  and no test of. The fake has to be able to answer them on request.

This repository already runs this pattern. `libs/query/src/scenarios` boots the real query client
against a stateful fake API with a deterministic clock. Copy that shape rather than inventing one;
the `query-scenario-tests` skill describes it.

### 3. A world the test declares

The fixture becomes an argument. A spec states the day it needs, and nothing global changes:

```ts
await seedWorld(page, {
  now: '2026-08-12T18:00:00+02:00',
  events: [...],
  jira: { issues: [...] },
  tempo: { worklogs: [...] },
  settings: { reasoning: { enabled: true } },
});
```

`seedWorld` writes the seed with `page.addInitScript`, before the app boots. `createFakePorts`
reads it. This generalises the `foreignMinutes` workaround into the one seam it should have been.

Keep one shared default world, so a spec that does not care states nothing.

### 4. A fixed clock

`now` comes from the seed, and the fake ports hand it to every surface that asks the time. Every
spec that turns on the time of day sets it. No spec reads the real clock.

## The flow checklist

`TESTING.md` becomes the coverage table. Each of its sections gets a target layer, and the manual
document keeps only what stays manual.

| `TESTING.md` section          | Flow                                     | Target        | State today |
| ----------------------------- | ---------------------------------------- | ------------- | ----------- |
| 3 Settings                    | Pick projects, read instance settings    | e2e           | Not covered |
| 4 The day view                | A day reconstructs and shows rows        | e2e           | Covered     |
| 5 The row boundary drag       | Pointer drag on a row split              | e2e           | Not covered |
| 6 Ask for suggestions         | The agent CLI answers, or does not       | e2e           | Not covered |
| 7 Create a ticket             | The draft, and the write                 | e2e           | Draft only  |
| 8 The week view               | Seven days read back                     | e2e           | Covered     |
| 10 The sync preview           | The plan, and what it subtracts          | e2e           | Covered     |
| 11 Sources and Host           | Each collector reports a state           | e2e           | Not covered |
| 12 Tempo coverage             | The week reads what Tempo holds          | e2e           | Covered     |
| 13 Branch repair              | The offer, the refusals, the run         | e2e           | Covered     |
| 14 Start a piece of work      | The plan, the refusals, the run          | e2e           | Covered     |
| 15 Editor heartbeats          | A reporter posts and lands in a block    | e2e           | Not covered |
| 16 Work versus private use    | A private link takes time out of a day   | e2e           | Not covered |
| 17 Timeline move, resize, add | Four pointer gestures                    | e2e           | Add only    |
| 1, 2, 9                       | Start the app, know what writes, defects | Documentation | —           |
| —                             | Store, pause, retention, compaction      | `cargo test`  | Not covered |
| —                             | Lock and PAM, tray, widget, idle         | Manual        | Manual      |

The three pointer sections are worth calling out, because they look hard and are not. Playwright
drives `mouse.move`, `mouse.down` and `mouse.up`, and `apps/storybook-e2e` already does exactly
this against real components in this repository. The `component-behavior-tests` skill holds the
patterns.

## The rule for every new flow

**A slice is not done until its flow has an e2e test.** Not "has unit tests and could be tested".

Each flow gets three tests, and the third is the one usually missing:

1. **The happy path.** It does the thing, and the screen says so.
2. **The refusal.** The one case the flow must refuse — a dirty tree, an empty project list, a 401
   — refuses, and says why.
3. **The round trip, where it writes.** Read the fake backend and assert what reached it. Then do
   it again and assert that the second run wrote nothing.

## How this fits the slices

Slice 1 is read-only, so its own e2e is cheap: seed a day, open the screen, assert the rows, the
three totals and the token counts. That makes slice 1 the right place to build the harness, and it
pays for itself immediately in slice 3, where the writes start.

So the slice plan gains a step 0:

| Step | What                                                       | Why now                                      |
| ---: | ---------------------------------------------------------- | -------------------------------------------- |
|    0 | The suite in CI, the stateful backend, the seed, the clock | Everything after it is cheaper, and guarded. |
|    1 | Today, honestly — with its e2e                             | The first user of the harness.               |

Step 0 is not a slice. It is the floor the slices stand on, and it is small: about 300 lines of
fake backend, a seed function, a clock, and three lines of workflow.

## Open questions

1. **Rust tests.** `cargo test` needs a target in `project.json` and a place in CI. The Rust
   toolchain is already a prerequisite for `tauri:build`, so the cost is a workflow step, not a
   new dependency. Decide it when the store next changes shape.
2. **A real Tauri run.** `tauri-driver` with WebdriverIO can drive the built app, host included.
   It is the only way to test the tray, the lock and the widget automatically. It is also a second
   driver, a second config and a much slower run. Not now; revisit if the manual list grows past
   about five checks.
3. **Screenshots.** The day timeline is the one screen where a wrong layout is a real defect and a
   DOM assertion misses it. A small set of Playwright screenshot comparisons may be worth it after
   slice 4, when the timeline stops changing shape every week.
