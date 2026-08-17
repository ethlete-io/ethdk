# `@ethlete/timetrack` - a Jira/Tempo time tracking helper

Scope worked out with Tom on 2026-08-11. A local-first cross-platform desktop app that
watches what you actually did, reconstructs a day of worklogs from that evidence, lets you
review and edit it, and syncs the result to Tempo - plus the ticket plumbing around it
(create a ticket under the right parent, create the branch, open the draft MR).

Everything below is grounded in what was verified on this machine (the local Claude Code
session logs, `fut-frontend`'s real branch names - and `niri`'s IPC, on the Wayland box this was
written on rather than the Mac it is now built on) or is explicitly flagged as unverified. Where an external API's shape matters to the design, the relevant detail is
named so the first implementation session doesn't rediscover it.

The git-flow reference is `plans/git-flow-draft.md` (German, explicitly not final).
`plans/git-flow-system.md` is the companion plan that turns that draft into the shared,
machine-readable grammar this one consumes; read it first if you are touching branch parsing,
ticket creation or the MR flow.

## Decisions already locked

| Question        | Decision                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Placement       | Publishable `libs/timetrack` core + `apps/timetrack` Tauri shell, both in this monorepo                  |
| Auth            | Fully local; each user registers their own OAuth clients; tokens in the OS keychain                      |
| Audience        | Anyone who installs it, but a strictly local application - the data never leaves the machine             |
| Interaction     | Hybrid: passive daemon as the base, optional explicit timer, retroactive API pull to fill/cross-check    |
| Local signals   | Active window + idle, local git repos, editor heartbeats, coding-agent session logs                      |
| Browser         | Window titles only; a generic ingest seam so an extension can be added later                             |
| Matching        | Deterministic rules first, LLM only for genuinely ambiguous blocks                                       |
| LLM             | Invoke the user's local agent CLI (`claude -p`, `codex exec`) so their subscription pays, not an API key |
| Jira/Tempo      | Jira Cloud (REST v3) + Tempo Cloud (API v4)                                                              |
| Ticket creation | Both directions: retroactive work → ticket, and prospective ticket → branch → pushed draft MR            |
| Granularity     | 15-minute rounding (configurable), day compared to a target with a warning, never silent fill            |
| Gap filling     | Confidence model; high-confidence entries sync without per-row review, weak ones must be accepted        |
| Platforms       | Pluggable window source, macOS-first now the dev machine is a Mac; degrade where there is none           |
| Storage         | Encrypted at rest, raw-sample retention window, exclusion rules, hard pause                              |
| Tempo sync      | Idempotent upsert of app-owned worklogs only; foreign worklogs read-only                                 |
| UI              | Tray presence + day timeline with an editable worklog list                                               |
| Daemon          | Rust collectors inside the Tauri app; starts minimized, autostarts on login                              |
| Phase 1         | Jira/Tempo + local collectors + Google Calendar + review UI + sync                                       |
| Name            | `@ethlete/timetrack`                                                                                     |

## The central insight: the branch name is the worklog

`git-flow-draft.md` defines a branch grammar that encodes the Jira hierarchy directly in
the path:

```
feat/FIP-2177-user-management                                      main feature branch  (Story)
sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset     sub-feature branch   (Task)
release/2026.04.28                                                 release candidate
sub/release/2026.04.28/FIP-2222-button-not-visible                 release fix          (Bug)
hotfix/FIP-2799-password-recovery-broken                           hotfix               (Bug)
```

The `sub/` prefix on the nested shapes is not cosmetic: git cannot hold a ref that is both a
branch and a directory of branches, so the unprefixed spelling the draft gives is uncreatable.
See `plans/git-flow-system.md`. What matters here is that the prefix **keeps the parent's full
path inside the child's name**, so Story-level roll-up stays a string operation on the branch
name with no lookup.

A sub-feature branch therefore carries **both** keys: the Story it belongs to and the Task
being worked on. That is the whole parent-matching problem solved by convention rather than
by inference - when the branch follows the grammar, no similarity search and no model call
is needed to know which Story a block of work rolls up to. Every downstream design decision
leans on this:

- The correlation engine's primary key extractor is a branch-grammar parser, not a loose
  `[A-Z]+-\d+` regex over free text.
- The LLM's job shrinks to blocks with _no_ branch context at all - meetings that aren't on
  a calendar, research, support, code review that left no local trace.
- The prospective ticket → branch flow is worth building precisely because it guarantees
  the grammar holds, which makes every later signal self-labelling. The tool is partly a
  convention-enforcement device, and that is a feature.

Two hard caveats:

1. **The draft is not final, and the naming does not match it yet - though the process largely
   does.** Of the ~16 branches created in `fut-frontend` since the convention's 29.5.26 cutover,
   three conform by name. But the two-level integration pattern already exists under the old
   `dev-*` spelling (reviewed sub-branches land in an integration branch, which merges to `next`,
   then `main`), so what is missing is the machine-readable encoding, not the workflow - which is
   why step 3 of the pipeline below can recover a Story key from a keyless branch. The parser
   therefore has to be configurable
   and tolerant, and it is not built here: it lives in `@ethlete/agent-rules/git-flow` and is
   shared with the skill, the check command, the hook and the CI job. See
   `plans/git-flow-system.md` for the grammar config, the tolerance rules and the per-branch
   evidence table. This plan only consumes it - it reads `storyKey`/`taskKey` from the parse
   result and penalises confidence when the result carries findings. Note the deliberate
   consequence of that plan's grace period: the naming zoo is accepted for a while yet, so
   keyless branches stay common, and the share of the day that reaches the reasoning provider or
   simply stays unattributed is higher early on than it will be later. Build the
   no-key-anywhere path as a first-class case, not an edge case.
2. **Most projects will never adopt the grammar at all, and one measured day is the proof.**
   Counted over 90 days in `ea-frontend`: 336 authored commits across 9 branches, of which 23
   (7%) sit on a branch that carries an issue key - and **253 (75%) were committed straight onto
   `next`**. Base resolution cannot help there, because `next` _is_ the base. So the whole ladder
   above - branch key, inherited key, MR activity - names nothing at all, and a day that is
   entirely real work proposes entirely nothing.

   This is not a transitional state to wait out. It is what a project without a ticket-writing
   habit looks like, and the app has to reconstruct a day there. See **Projects without the
   grammar** below, which is the answer and is built.

   One thing that measurement retired: `%S` does **not** hand a merged commit to the integration
   branch. `git log --branches` reaches a commit through the alphabetically earlier ref, so a
   commit made on `feat/fip-2883-…` still reports that branch long after it merged into `next`
   (verified with `merge-base --is-ancestor` on three merged branches). The 253 are genuinely
   commits made on `next` itself.

3. **Commit subjects never carry the key.** They are strict conventional commits
   (`feat(platform): Prefer a player's common name over their last name`). Do not build the
   key extractor around commit messages; use them as _description_ material for the worklog
   text, which is exactly what they are good for.

## Repo shape

```
libs/timetrack/                     @ethlete/timetrack - framework-agnostic TS
  src/lib/
    model/                          events, blocks, proposals, worklogs, confidence, evidence
    correlate/                      the pipeline: sessionize → attribute → merge → round → warn
    providers/
      jira/  tempo/  gitlab/  google-calendar/  gmail/  slack/  discord/
    reason/                         the agent-CLI reasoning provider + prompt contract
    transport/                      the HTTP/exec/storage ports the host must supply
apps/timetrack/                     private Angular app (@ethlete/components UI)
  src/host/                         the TS adapters that satisfy the ports over Tauri `invoke`
  src-tauri/                        Rust: collectors, storage, keychain, tray, process spawn
    db.rs  state.rs                 schema + open/migrate; the managed Mutex<Connection>
    keychain.rs  secrets.rs         the key and the provider tokens
    http.rs  process.rs  store.rs   the commands behind the five ports
```

**The shell is built.** The Nx project is `timetrack-app` — the library already owns the name
`timetrack` — and `tauri:dev` / `tauri:build` are `nx:run-commands` targets deliberately outside the
default pipeline. Prerequisites and the command-to-port table are in `apps/timetrack/README.md`.

### Why the core is framework-agnostic and transport-agnostic

The core lib contains no Angular and issues no network calls itself. Two reasons, both
non-negotiable:

- **CORS.** Jira Cloud, Google and Tempo do not allow browser-origin requests from a Tauri
  webview. All HTTP must go out through Rust (`tauri-plugin-http` / `reqwest`), which is
  also where the tokens belong - they should never be readable from the webview at all.
- **Testability.** Correlation is the part with the actual logic and the part most worth
  unit-testing. It has to run in `vitest` against fixture event streams with no Tauri, no
  browser and no network.

So the core defines ports and the app supplies them:

```ts
interface TimetrackTransport {
  request$<T>(req: TimetrackRequest): Observable<TimetrackResponse<T>>;
}
interface TimetrackSecretStore {
  read$(key: string): Observable<string | null>;
  write$(key: string, value: string): Observable<void>;
}
interface TimetrackEventStore {
  eventsBetween$(from: Date, to: Date): Observable<CollectedEvent[]>;
}
interface TimetrackProcessRunner {
  run$(spec: ProcessSpec): Observable<ProcessResult>;
}
```

**All five are now supplied** — `apps/timetrack/src/host/`, one adapter per port, each a cold
`defer(() => from(invoke(...)))`. What building them settled:

- **The event store's port cannot express the transaction the cursors need.** `append$(events)` has
  nowhere to put them, so the host's store adds `appendWithCursors$`, and the agent-session collector
  must use it — the events and the cursors have to commit together or a lost cursor re-reads its log
  and appends every sample twice. Same reason `cursors$`, `compactedThrough$` and
  `setCompactedThrough$` live on the host type rather than the port.
- **Rust never interprets an event.** A row is `at_ms`, `source`, `kind` and the whole event as
  opaque JSON; the first three are lifted out only so a range query and a per-source retention pass
  do not parse it. Exclusion already ran in the core, so the store has no opinion to hold, and adding
  an event kind needs no Rust change at all.
- **`run_process` takes an allowlist** (`git`, `claude`, `codex`). "The host spawns the process" left
  this open, and an open spawn command makes any script that reaches the webview code execution.
- **A non-2xx response is returned, never raised.** The providers already read status and body to
  tell a quota breach from a bad token, so raising would destroy what they need.
- **`db::open` takes the key rather than fetching it.** Reading the keychain inside it would make the
  whole store untestable without a running secret service; the caller in `lib.rs` fetches the key.

Repo conventions that apply to the lib (see `AGENTS.md` and the `styleguide` /
`rxjs-signals` skills):

- **Async API returns cold Observables, never Promises**, and observable-valued properties
  carry the `$` suffix. `rxjs` is a peer dependency. The Rust side is promise-based via
  Tauri's `invoke`; wrap it once at the transport boundary with `defer(() => from(invoke(...)))`
  so the lib's surface stays cold and cancellable.
- Synchronous state in the app is signals; only genuinely async work is RxJS.
- Each change to the published lib needs a changeset (`changeset` skill). `apps/timetrack`
  is `"private": true` and needs none.
- `libs/timetrack` depends on `@ethlete/types` and on `@ethlete/agent-rules/git-flow` (the
  pure, Node-free grammar entry point - see `plans/git-flow-system.md`). It must not depend on
  `@ethlete/query` or `@ethlete/core` - both are Angular. The app may use `@ethlete/query`
  to drive the lib's Observables into signals, and `@ethlete/components` for the UI.

### Build and CI implications

The Tauri app brings a Rust toolchain and a per-OS build matrix into a repo that currently
builds only Angular libs. Keep them apart: `apps/timetrack` gets `lint`/`test` targets in
the normal graph, but `cargo`-touching targets (`tauri:dev`, `tauri:build`) stay out of the
default CI pipeline and out of the `ci-check` skill's flow. Desktop releases get their own
workflow, triggered by tag, with its own matrix. The `tools/treeshake` bundle goldens do not
apply to either project. Nx Cloud stays off per `AGENTS.md` (`NX_NO_CLOUD=true`).

**The window runs in a plain browser for the e2e suite.** `apps/timetrack/src/main.e2e.ts` bootstraps
the same `AppComponent` with `HOST_PORTS` swapped for in-memory fakes, so `apps/timetrack-e2e/` drives
real views under Playwright with no Tauri, no network and no keychain. What building it settled:

- **One seam carries the whole harness.** Every host capability already hangs off `HOST_PORTS`, so the
  fake is one provider override rather than a parallel application. A capability that grows its own
  import path would break this before it broke anything else.
- **`tauri-driver` is Linux and Windows only**, so the real window cannot be driven on macOS at all.
  The browser run is not a lesser substitute for a desktop run here; it is the only automated run
  there is, and sections 1 to 12 of `apps/timetrack/TESTING.md` are what covers the rest.
- **A fixture cannot be seeded through the URL.** The router uses `withHashLocation()`, which drops the
  query string on the first navigation, so a test seeds `localStorage` with `page.addInitScript`.
- **A proposal starts as `suggested` and does not sync**, so any test about the subtraction has to
  accept the row first. The suite asserts the wiring between views; the arithmetic stays unit-tested.

## Data model

Four layers, each derived from the one before, each kept so the chain is auditable:

1. **`CollectedEvent`** - a raw observation, append-only, from one collector. Timestamp,
   source, kind, payload. Never edited, expires per the retention policy.
2. **`ActivityBlock`** - contiguous same-context time after sessionizing (idle gaps split,
   sub-minute flapping merged). Carries the union of evidence that produced it.
3. **`WorklogProposal`** - a block or set of merged blocks attributed to an issue, with a
   duration, a description, a confidence, an evidence chain, and a state
   (`suggested` | `accepted` | `rejected` | `edited` | `synced`).
4. **`SyncedWorklog`** - a proposal that exists in Tempo, holding the Tempo worklog id, the local day
   it sits on and a content hash for change detection. The day is what makes ownership readable
   without the proposal that produced it.

`Evidence` is the load-bearing type. Every proposal must be explainable in the UI as a list
of concrete observations ("branch `sub/feat/FIP-2177-user-management/FIP-2178-…` checked out
09:12", "17 commits", "Claude Code session `51312183` in `/home/tom/dev/fut-frontend`",
"calendar event _Sprint Planning_ 10:00-11:00, you accepted"). If a proposal cannot be
explained, it must not be pre-checked - that is the entire trust model.

`Confidence` is a small enum (`certain` | `likely` | `weak`) computed from evidence class,
not a float. `certain` = a conforming branch key or an accepted calendar event with a Meet
URL matched to a window title. `likely` = a partial branch match, a Jira issue view, a
GitLab MR review event. `weak` = an inferred filler (a Discord voice session, an
idle-adjacent gap, a Slack huddle with no calendar counterpart). Per the locked decision,
`certain` and `likely` sync without per-row review; `weak` never syncs until accepted.

## Collectors

### Active window + idle (Rust, phase 1)

Verified on this machine: `niri msg -j focused-window` returns
`{"id":5,"title":"git-flow-draft.md - ethlete-sdk - Visual Studio Code","app_id":"code","pid":8701,"workspace_id":2,...}`,
and `niri msg -j event-stream` pushes `WindowsChanged` / `WorkspacesChanged` /
`OverviewOpenedOrClosed` records as JSON lines. Real titles seen while writing this plan:
`git-flow-draft.md - ethlete-sdk - Visual Studio Code` (file _and_ workspace) and
`Git Workflow - Electronic Arts - Confluence - Google Chrome` (page title). That is why
"window titles only" is a defensible browser strategy - the title is the page.

There is no portable Wayland API for the focused window, but there is a better answer than
per-compositor IPC. `niri` advertises both `ext_foreign_toplevel_list_v1` and
`zwlr_foreign_toplevel_manager_v1` (confirmed in the binary's protocol strings). The wlr
protocol reports `title`, `app_id` and - crucially - the `activated` state, which the `ext`
version deliberately dropped. So:

- **Primary window source: a `zwlr_foreign_toplevel_manager_v1` client.** One
  implementation covering niri, sway, Hyprland, KWin, wayfire and cosmic. Push-based, no
  polling.
- **Compositor IPC as optional enrichment** where it adds what the protocol lacks (niri:
  workspace id, pid, focus timestamp; sway: `swaymsg -t subscribe window`).
- **X11 fallback** via `_NET_ACTIVE_WINDOW` + `_NET_WM_NAME` (XCB).
- **GNOME/Mutter supports neither protocol** and needs a shell extension. Document it as an
  unimplemented gap, not a bug - and make sure the app is honestly usable without a window
  source at all (git, agent logs, editor heartbeats and the APIs still reconstruct a decent
  day). Show a one-line banner naming what is degraded.
- **Idle** via `ext_idle_notifier_v1` (confirmed supported by niri) - register thresholds
  and receive idle/resume notifications rather than polling. Fall back to logind's
  `IdleHint` and the session `Lock`/`Unlock`/`PrepareForSleep` signals, which also give
  laptop-lid and suspend boundaries for free.
- **macOS** is built - see below. **Windows**, if it arrives: `GetForegroundWindow` +
  `GetWindowText` (trivial by comparison).

Titles are the most sensitive thing collected. They are matched against the exclusion rules
_before_ being written, and the sampled title of an excluded app is never persisted at all.

**Built, on Wayland first** - `src-tauri/src/window.rs` holds the buffer and the two commands,
`window_wayland.rs` the `zwlr_foreign_toplevel_manager_v1` + `ext_idle_notifier_v1` client on its own
thread, and `src/collectors/window-collector.ts` drains it. What the plan did not say:

- **`event_created_child!` goes _inside_ the `impl Dispatch` block.** Written beside it, it compiles
  as an unused free function and the client panics on the first toplevel with "Missing
  event_created_child specialization for event opcode 0". Nothing in the type system catches this.
- **The samples cross into the webview rather than being written in Rust**, because the exclusion
  rules are TypeScript and a denied title must never reach the database. That is the whole reason
  there is a buffer at all.
- **The buffer is acknowledged, not drained.** `window_events(afterSeq)` releases what was stored and
  returns the rest, so a webview that reloaded between reading and storing repeats a sample instead
  of losing one. Repeats are identical and collapse in `sessionize`; a gap reads as absence.
- **`idled` fires a threshold _after_ input stopped**, so the sample is dated `now - threshold`.
  Dating it `now` would bill every break its first five minutes.
- **A panic on that thread is caught** so the status stops claiming `wayland-wlr`. The status is what
  the UI shows the user; a dead thread behind an "it's running" banner is worse than no source.

Verified on niri: focus samples arrive per switch and per title change, and the idle threshold is
5 minutes - well under `maxUnobservedMs`, so a real break splits a block and thinking time does not.

**Built on macOS too** - `window_macos.rs`, behind the same buffer and the same status, so nothing
above it knows which platform it is on. What building it settled:

- **The permission splits the source in two, and only one half needs it.** Idle comes from
  `CGEventSourceSecondsSinceLastEventType`, and the frontmost application from
  `NSWorkspace.frontmostApplication` - neither asks for anything. Only the window _title_ needs
  Accessibility, through `AXUIElementCreateApplication(pid)` → `AXFocusedWindow` → `AXTitle`. So an
  ungranted machine is `macos-app-only` rather than `none`: it still says which application was in
  front and when the user was there, and it says so in the status. Measured with no permission at
  all, on a locked screen: `com.apple.loginwindow`, and the idle timer running for 79 minutes.
- **Titles need a poll; nothing pushes them.** macOS pushes application activations, but a browser
  tab switch changes only the title, so the window is read once a second and emitted on change - the
  same emit-on-change rule the Wayland `commit` uses, and the reason a poll is affordable at all.
- **Polling reads the true gap, so both presence transitions are dated when they happened.** The
  idle timer says how long ago input stopped, so an idle start is dated `now - idle` rather than
  `now - threshold`, and an idle end is dated when input returned rather than when the poll noticed.
- **An Accessibility read is IPC into the target application**, and an unresponsive one would hold
  the sampler thread for as long as it likes. `AXUIElementSetMessagingTimeout` bounds it at a second.
- **The permission is re-read every tick, and the webview re-reads the status on every drain**, so
  granting it turns titles on without a restart. `window_request_accessibility` is what the sources
  screen's button calls; macOS shows its dialog once per binary and only ever opens Settings after
  that, so the command answers the state rather than the user's decision.
- **The window is not sampled while idle.** Nobody is at the machine, and the sample taken when they
  come back re-establishes the context anyway.
- **The bindings carry neither `kCGAnyInputEventType` nor the AX attribute names**, because all of
  them are C header macros rather than enum members. They are spelled out in the source.

The rules themselves - the two datings, the emit-on-change, not looking while idle, the permission
arriving mid-run - are unit-tested through `Sampler::apply`, which takes the readings rather than
taking them. The platform calls around it were driven from a scratch crate that `#[path]`-includes
`window_macos.rs` beside a printing stand-in for `WindowSource`: it needs no tauri, so it compiles in
seconds and prints real samples off this machine.

Still unverified: everything behind a granted Accessibility permission. The screen was locked while
this was built, so the title path has run only in its ungranted form.

### Local git repos (Rust, phase 1)

**Built end to end.** `libs/timetrack/src/lib/git/`: `collectGitEvents$` runs two `git` commands per
configured root through `TimetrackProcessRunner` and returns checkout and commit events, with a
per-command `failures` list so one stale root cannot cost the day. The host half is
`src-tauri/src/git.rs` - repository discovery plus the watch - and the collector is
`src/collectors/git-collector.ts`. Verified live: the day view's blocks now carry branch labels.

What building the host half settled:

- **Discovery has to exist before configuration does.** With no root configured the host walks the
  home directory to depth 3, skipping hidden and dependency directories and stopping at each
  repository rather than descending into it - a repository inside a repository is a submodule or a
  vendored copy whose commits already belong to the parent's history. This machine yields 4 roots.
  `git_repos` now takes the settings' `gitScanRoots` (a list, each walked to depth 3, so naming
  `~/dev` also reaches deeper than the home directory can), and the collector re-discovers as soon as
  that list changes rather than at the next hourly walk.
- **Watch the `.git` directory, not `HEAD`.** A checkout writes `HEAD.lock` and renames it over
  `HEAD`, so a watch on the file ends up pointing at the replaced inode. The directory sees the
  rename. `.git/refs` is watched recursively on top, and everything else in there - the index, the
  object database, a `.lock` still being held - is filtered out, or every `git status` would rescan.
- **The watch needs no acknowledgement protocol**, unlike the window source: the reflog and the commit
  log are durable, so a lost notification costs latency and the 10-minute reconcile heals it. That is
  what lets `git_changes` be a plain counter.
- **A scan that overlaps itself needs a dedupe key**, and that is a store concern, not a git one. See
  `dedupeKeyOf` under Storage below. With it the first scan of a session can be 30 days wide - which
  is what actually delivers "a day still arrives after the app was closed" - and every scan after it
  26 hours, re-reading freely.
- **The author is resolved per repository** (`git config --get user.email` once per root at
  discovery). A work checkout and a personal one are often two different addresses, and one wrong
  address silently collects nobody's commits.
- Watches are capped at 128 repositories and the overflow is reported in the panel rather than
  dropped silently; on this machine `max_user_watches` is 828k, so the cap is nowhere near binding.

Under the grammar this yields the Story/Task keys; the commit subjects yield the worklog description.
What building it settled:

- **Branch switches come from `git reflog show --date=iso-strict`**, whose `%gd` is the instant HEAD
  actually moved. Only `checkout: moving from … to …` counts: a rebase's or a pull's internal
  checkouts are tooling moving HEAD, not the user changing what they work on. Real reflogs here hold
  all of those, so the filter is load-bearing. A detached checkout records an object name where a
  branch would be and is dropped.
- **A commit's branch comes from `%S` under `--branches`** - there is no other way for `git log` to
  say which branch a commit belongs to. Caveat found the hard way: `%S` prints the ref as the command
  line spelled it, so `--branches` yields `next` where `--all` yields `refs/heads/next`.
- **A commit is timed by its author date, and the window filter has to be applied to that** - `--since`
  and `--until` read the _commit_ date, so rebasing last week's work today would otherwise log it
  today. Measured on this machine: 7 of 215 commits in a week were exactly that case.
- Merges are excluded: the subject is generated text, and the commits they bring in are already
  reported under their own branch.
- Restricting commits to one `--author` is what keeps somebody else's work, pulled or rebased in, out
  of the day.
- Changed paths are not collected. `Evidence.summary` carries the subject, and adding paths means
  teaching `describe` what to do with them - a phase-2 question, not a collector one.
- Rebases and stashes mark context switches but have no event kind in the model, so they are not
  emitted. Revisit only if real days show blocks that nothing else explains.

### Coding-agent session logs (Rust or TS, phase 1)

**The core half is built** - `libs/timetrack/src/lib/agent-session/`: `AgentSessionLogParser` is the
seam Codex plugs into, and `parseClaudeCodeSessionLog` implements it. `collectAgentSessions$` drives
it over every log the host lists, one after another, and hands back a cursor per log.

**The host half is built too** - `apps/timetrack/src-tauri/src/logs.rs` behind the `agent_logs` and
`agent_log_lines` commands, with `createTauriAgentSessionLogReader` as the adapter on
`HostPorts.agentLogs`. Cursor persistence was already done (`events_append` takes them in the same
transaction, because a cursor that goes missing re-reads its log from the top and appends every
sample in it twice). Three things the plan did not say:

- **The root has to be a parameter, not a constant.** Confining reads to `~/.claude/projects` is what
  keeps a `path` arriving from the webview from reading any file the user can - the same reasoning as
  `run_process`'s allowlist - but a fixed root would also make the reader untestable, so the command
  takes the root and validates containment against it after canonicalising both.
- **A missing root is not an error.** A machine that never installed the agent has no
  `~/.claude`, and the collector has to see an empty list rather than a failure.
- **A cursor pointing past the end of a log means the log was replaced, not appended to**, and
  leaving it there strands that log for good. The read falls back to the top; the cursor's _instant_
  is what keeps the samples already seen from being appended twice.

Eight tests cover it, the last reading this machine's real logs.

**The timer that drives it is built** - `apps/timetrack/src/collectors/agent-session-collector.ts`,
polling every 60s. It reads the cursors, collects, and writes the events and the moved cursors back
through `appendWithCursors$` in one transaction. Two things worth keeping:

- **Ticks arriving mid-run are dropped, not queued** (`exhaustMap`). The first run on a machine reads
  every log it has ever written, which takes longer than a poll interval; queueing would stack runs
  up behind it and append the same samples twice.
- **`modifiedAfter` only moves when a run persisted.** Moving it on a run that failed would skip the
  logs that run never got to read, and nothing would ever come back for them.

First real run on this machine: 477 logs imported, back to 13 July, 0 unparsed lines. The run a
minute later found 5 new samples, which is the incremental path working.

Verified: Claude Code writes `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`, where the
directory name is the working directory (`-home-tom-dev-fut-frontend`), and `user` /
`assistant` / `system` / `attachment` records each carry `timestamp`, `cwd`, **`gitBranch`**
and `sessionId`.

This is the single best-value collector per line of code in the whole plan: it gives precise
start/end timestamps, the project, the branch (hence the Story and Task keys), and a
human-readable statement of what the session was about - all from tailing a JSONL file. No
API, no permission, no OAuth. Note the log also contains prompt and response text; parse
only the metadata fields and the title, and never persist message bodies.

What building it against the 436 logs on this machine settled, and the plan above had wrong:

- **`cwd` and `gitBranch` are per record, not per session** - 23 of the 436 logs change one
  mid-session. The parser therefore keys context per record, and a change always emits a sample even
  inside the sampling interval, so a mid-session checkout splits the block the way a real one does.
- **The title lives in an `ai-title` record's `aiTitle` field**, and that record carries only
  `sessionId` and the title - no timestamp, no `cwd`. It is rewritten as the session grows, so the
  last one wins. A session the user renamed writes `custom-title` / `customTitle` the same way, and
  that name beats the generated one.
- **A cursor is a line offset _and_ the instant of the last sample.** The offset alone would let a
  record the agent appended out of timestamp order through a second time; the instant alone would
  re-read the whole log every run.
- **A `last-prompt` record is appended per prompt**, so the _first_ in file order is the prompt that
  opened the session. That is the fallback title, and taking the last would describe only what the
  session ended on.
- **Sampling is what makes this affordable**: 184,617 records across the 436 logs thin to 10,176
  events (18:1) at one sample per minute, and the largest single log (4,140 lines) yields 255.
- Records are matched by _shape_ - anything carrying `timestamp`, `cwd` and `sessionId` is a sample -
  so `queue-operation` counts and a record type a future release adds lands without a change here.
- A log read while the agent is writing ends in a partial line, so an unparseable line is counted
  (`unparsedLines`) rather than thrown on. Across all 436 logs, zero.

Codex's equivalent (`~/.codex/sessions/**`) is unverified - `codex` is not installed on this
machine.

### Editor heartbeats (phase 2)

**Both are built** - the generic ingest endpoint in `apps/timetrack/src-tauri/src/ingest.rs` and the
VS Code extension in `apps/timetrack-vscode`. The extension posts every 30 seconds while its window
has focus; the endpoint buffers what arrives, the collector interprets it, and a heartbeat labels a
block with the checkout and branch that no window title could name. What building it settled:

- **The token is generated per app start and written to a file, not kept in the keychain.** The
  original sketch said keychain, but a reporter cannot read a keychain, so the secret would have had
  to reach it some other way - pasted into the editor's settings, where it would sit in plain text
  and possibly sync. `ingest.json` in the app data directory, mode 0600, holds the port and a token
  that dies with the run: there is no durable secret to leak, the reporter needs no configuration at
  all, and a reporter left over from an earlier run is refused rather than trusted.
- **An ephemeral port, not a fixed one.** The OS picks it and the file records it, so two accounts
  running the app never collide and nothing has to be registered anywhere - the same arrangement the
  OAuth loopback already uses.
- **A request carrying an `Origin` header is refused before its token is even checked.** A reporter
  is a program, never a page. A site the user happens to have open cannot read a 0600 file, but that
  is one mistake away from being the only thing stopping it; refusing every browser closes it
  outright. It is also why a future Chrome extension will need a deliberate change here rather than
  arriving by accident.
- **The host interprets nothing.** It lifts `atMs` and `kind` so the buffer can be dated and drained,
  and passes the rest through as opaque JSON. `parseIngestedRecords` in the core is the only place a
  posted shape becomes an event, so an unknown `kind` is counted and dropped rather than stored - and
  a reporter that learns to send something new needs no change in Rust.
- **The heartbeat reports the directory, not the file.** `libs/components/src/lib/table` is what
  makes a stretch recognisable; the file name adds nothing anything reads, and one evidence entry per
  file would bury a block under a hundred of them. It also keeps the promise the Sources row makes
  small enough to be worth making.
- **A path is subject to the title-pattern exclusion rules.** A heartbeat carries no title, so
  without this a rule that hides a client's name from every other source would let it through here.
  `editor` evidence is deliberately **not** quotable: a path names a private checkout as readily as
  this one.
- **The buffer is shared with the window source.** Keep-until-acknowledged, drop-oldest and the
  pause gate are identical for both, so they became `SampleBuffer<T>` in `samples.rs` rather than the
  same sixty lines twice.
- **A pause drops what arrives and still answers the reporter with a success.** Telling it the post
  failed would only make it hold the same records and offer them again at every interval until the
  pause ended, which is the opposite of what a pause is for.
- **The extension holds at most 60 unsent records.** Enough to cover the app restarting under it,
  far too few to become a log of the day - an editor is the wrong place to keep one, and the parser
  refuses anything over a day old anyway.
- **`ethlete/no-async-await` and `ethlete/prefer-rxjs-timer` are off in the extension.** VS Code's
  API is promise-based and there is no injection context for `takeUntilDestroyed`; obeying them would
  have put RxJS in a bundle that has no other use for it. The bundle is 3.9 kB.

### Jira Cloud (phase 1)

REST v3 on the user's Cloud host with an API token (email + token, Basic) or a per-user
OAuth app. Needed for: resolving keys to issue ids (Tempo v4 wants ids), reading open
issues for the retroactive parent search, reading the issue-type and hierarchy config, and
creating issues.

Two things that will bite:

- **v3 create/update wants ADF** (Atlassian Document Format) for description fields, not
  plain strings. Wrap description building once.
- **`/rest/api/3/search` is gone** in favour of `/rest/api/3/search/jql` with
  `nextPageToken` cursor paging and explicit `fields`. Write the pager against the new shape.

**Open question flagged for discovery, not assumption:** `git-flow-draft.md` says
Story → Task, but Jira's default hierarchy puts Story and Task at the _same_ level (Epic
above, Sub-task below). So "a Task under a Story" is only real if their instance names its
sub-task type "Task", uses a Premium custom hierarchy level, or expresses it as an issue
link. Phase 1 must read `/rest/api/3/issuetype` and the project's hierarchy at setup and
support both parent-field and issue-link parenting, chosen per project in settings. Getting
this wrong means the create flow files tickets in the wrong place, which is worse than not
having the flow.

**Built** - `libs/timetrack/src/lib/jira/`, all of it through `TimetrackTransport`:

- `client.ts` - Basic auth over the account email, host normalization, and status mapping into a
  `JiraRequestError` that distinguishes a rejected credential from an invisible resource. The
  credential is UTF-8 encoded before base64, because `btoa` alone throws on a non-ASCII email.
- `search.ts` - the `/rest/api/3/search/jql` cursor pager, `maxPages`-bounded so a runaway JQL
  cannot page forever against a rate-limited API.
- `issue.ts` - `fetchJiraIssues$` / `fetchJiraIssueIds$`, batched 50 keys per JQL string. A key
  Jira does not know is simply absent from the result: correlation can produce one from a typo in
  a branch name, and one bad key must not fail the whole day. `fetchJiraIssueKeysByIds$` resolves
  the other direction, which is what makes a Tempo worklog readable at all.
- `hierarchy.ts` - `describeJiraHierarchy$` reports the levels the instance actually has and a
  `suggestedParenting` of `parent-field` or `issue-link`. It only ever suggests; settings choose.
- `activity.ts` - the issue-view rung. `updatedBy(currentUser(), from, to)` is the only Jira
  signal that carries a **timestamp**; `issueHistory()` (recently viewed) has none, so it cannot
  place a block and is not used.

Not built here: ADF description building and issue creation, which belong with the phase-2 create
flows and would be dead code until then.

### Tempo Cloud (phase 1)

API v4 at `api.tempo.io/4/`, Bearer token, **separate from Jira's credentials** - two
distinct secrets in the keychain. Worklogs reference `issueId` (numeric), so a key → id
resolution step through Jira is mandatory on every sync.

Sync semantics per the locked decision:

- On setup, read `/4/work-attributes` and adapt the review UI to whatever attributes the
  instance requires (billable flag, work category, Account). Configurable per-project
  defaults, per-entry override. Never guess a required attribute's value.
- Each app-owned worklog gets a stable local id embedded in a Tempo attribute (or, if none
  can be added, a marker suffix in the description). Re-syncing a day updates and deletes
  only worklogs carrying that id.
- Foreign worklogs (created by you in Tempo, or by anyone else) are pulled read-only, shown
  in the day view as already-accounted time, and **subtracted from what the app proposes**.
  This is what makes a second sync of the same day safe.
- Sync is a two-phase operation with a preview diff (create N, update M, delete K) and a
  single confirm. Partial failures are surfaced per row and retried individually.

**Built - the read side, the diff and the write half, `libs/timetrack/src/lib/tempo/`:**

- `client.ts` - Bearer auth against the v4 base, `TempoRequestError` status mapping, and
  `tempoPaged$`, which follows `metadata.next` (an **absolute** URL, so the request helper takes a
  full URL as well as a path) and is `maxPages`-bounded like the Jira pager.
- `attributes.ts` - `fetchTempoWorkAttributes$`, plus `missingRequiredAttributes()`, which is how
  "never guess a required attribute's value" is actually enforced at sync time. An attribute of an
  unmodelled type is dropped from the schema rather than half-rendered.
- `worklogs.ts` - `fetchTempoWorklogs$` over `/worklogs/user/{accountId}` with a **date**-based
  inclusive range. Tempo sends `startDate` and `startTime` separately, both in the user's local
  wall clock - parsing either as UTC silently shifts a day. `toHistoricalWorklogs()` is the feed
  `detectRecurringPatterns()` was already waiting for.
- `subtract.ts` - `subtractForeignTime()`. Matching is **per issue over the day, not per
  overlapping interval**: a Tempo start time is frequently nominal (hand-entered, or carried over
  by a template), so an hour logged against an issue is the same hour wherever the evidence puts
  it. Foreign time outliving its proposals is reported as `unmatchedMs`, never as a negative
  duration.
- `diff.ts` - `planTempoSync()` and `contentHashOf()`. **Ownership comes from the local ledger and
  nothing else:** a worklog no `SyncedWorklog` points at is foreign and is never written or
  deleted, however much it looks like ours. That is what makes the app safe against an instance
  people also use by hand. It also distinguishes a worklog deleted in Tempo (recreate) from one
  edited there behind the app (`changed-in-tempo`), and reports a proposal whose key resolved to no
  Jira id instead of writing without one.
- `wall-clock.ts` - `tempoDay()`, `tempoTimeOfDay()`, `parseTempoWallClock()`. One place for the
  "Tempo speaks the user's local wall clock, in two fields" rule, now that both directions need it.
- `marker.ts` - the marker as a **configured scheme**, not a decision the code makes:
  `attribute` (a free-text work attribute, nothing visible changes), `description-suffix`
  (`… [et:<proposalId>]`, works on any instance) or `none` (the ledger is the only owner record).
  `applyWorklogMarker()` is idempotent, and `recoverLedgerFromMarkers()` is what a lost ledger is
  rebuilt from - with an empty `contentHash`, so the next sync re-asserts content it cannot verify,
  and with a proposal two worklogs claim reported as `ambiguous` rather than half-adopted.
- `write.ts` - `createTempoWorklog$` (answers with the new worklog id, and **fails** if Tempo
  returns none rather than reporting an unowned worklog as written), `updateTempoWorklog$`,
  `deleteTempoWorklog$`. `billableSeconds` is only sent when the caller has a policy for it
  (open question 5); otherwise Tempo's own default stands.
- `execute.ts` - `executeTempoSync$()`, phase two of the sync. Serialized writes, **every delete
  before any create**, one `TempoSyncRow` per write (`written` / `blocked` / `skipped` / `failed`),
  `ledger` upserts and `prunedProposalIds` that never name the same proposal, and `retry`: the rows
  that did not land, shaped as a plan the same function accepts.

What the write half settled:

- **Tempo v4 cannot move a worklog to another issue**, so a proposal whose key changed is a
  `issue-changed` delete plus a `recreated-after-issue-change` create - visible in the preview, not
  smuggled into the executor. Delete runs first: if the create then fails the row is retryable, where
  the other order would leave the same hour logged on two issues with no ledger entry to find it by.
  A create whose delete failed is reported `skipped` and never sent.
- **A `description-suffix` marker is part of the remote text and not of the proposal's**, so
  `planTempoSync()` takes the same `marker` and strips it before comparing - without that, every
  synced worklog reads as `changed-in-tempo` forever.
- **A 404 on delete is success.** A worklog that is already gone is what the delete was for.
- **A required attribute with no value blocks its row** (`missingRequiredAttributes`) instead of being
  guessed, and the row goes into `retry` for once the reviewer supplies it.

- `preview.ts` - `previewTempoSync$()`, the read-only first phase: the account lookup, then the issue
  ids, the day's remote worklogs and the day's whole ledger, folded into a `TempoSyncPlan`. It takes
  the day rather than a range, so the two cannot disagree - see the sync view below. It resolves the issue
  **keys** for the ids only the remote worklogs mention (`fetchJiraIssueKeysByIds$`) too, because
  Tempo names an issue by a numeric id and a foreign list nobody can read is a foreign list nobody
  checks. `fetchJiraMyself$` in `jira/myself.ts` is where the account id comes from - Jira's own UI
  never shows it, so it cannot be a setting.

**The confirm step is now wired** - `apps/timetrack/src/app/sync/` calls `executeTempoSync$` behind an
explicit button, records what landed in the ledger, and lists every row's outcome. What wiring it
settled, all of it about the same hazard - the same hour logged twice:

- **A plan is spent once it is submitted**, and the write button stays disabled until a fresh plan is
  read. The plan carries the ownership decision for each row, so re-sending one after the writes
  landed would create what it already created.
- **The app never re-plans on its own initiative after a write.** Tempo is eventually consistent, so a
  plan read straight after a write can report a worklog it just accepted as missing - which reads as
  `recreated-after-remote-delete` and invites exactly the second write the ledger exists to prevent.
  Re-planning is the reviewer's own action.
- **A retry runs the outcome's `retry` plan, never a fresh read.** It holds only the rows that provably
  did not land, so retrying cannot resend one that did.
- **The run is `exhaustMap`, not `switchMap`.** Cancelling writes that Tempo has already taken would
  leave them unowned, which is the one failure the ledger cannot recover from.
- **A ledger write that fails is its own error state**, not a row status: the worklogs exist in Tempo
  and nothing local points at them. The view says so, names what to delete by hand, and the day must
  not be written again until it is fixed.
- The work-attribute schema is read as part of the run, so a required attribute **blocks** its row
  locally rather than being reported by a Tempo 400.
- The plan and the writes must read the **same marker scheme** or every synced worklog compares as
  edited in Tempo forever. Both run `none` (open question 4); they are changed together.

**Foreign time is now subtracted, and what it covers is written down.** A Monday already logged in
Tempo by hand read as unfinished and planned a second copy of every hour - two defects, one cause.
`subtractForeignTime()` had been written and never called, and nothing outside the Sync view could see
Tempo at all. `planTempoSync()` now reduces every syncable proposal by it, and `previewTempoSync$()`
returns a `TempoDayCoverage` the app stores per day (`TimetrackCoverageStore`, schema v9's
`tempo_coverage`). What building it settled:

- **A reduction to zero on an app-owned row is a delete, not a skip.** Tempo holds the hour twice
  otherwise - once by hand and once by this app - and the day's total is what has to come out right.
- **The record is keyed by issue and not by proposal.** Rows are re-derived from the evidence on every
  read, so a proposal id is not a name that survives; the issue key is, and it is already the unit
  `subtractForeignTime()` matches on. That is what lets the week view reuse the function rather than
  imitate it, so the two can never disagree about which days are finished.
- **The preview returns the record; the app stores it.** A function called `preview` that writes is a
  function nobody trusts to be read-only, and the write must never fail the preview - the reviewer
  asked for a plan, not for a record.
- **Only the Sync view can ever fill it in**, so a day nobody has previewed still reads as unsynced,
  and a day whose foreign time was deleted in Tempo reads as covered until the next preview. Both are
  the price of answering with no token, which is the constraint `dayReviewGap` was built under.
- **`ForeignWorklog.from` is optional**, because the matching never used it. A caller holding a day's
  totals per issue can now pass them without inventing a start time the rule would ignore.

### Google Calendar (phase 1)

Own OAuth desktop client, PKCE + loopback redirect, scope `calendar.events.readonly`.
`events.list` with `singleEvents=true` and a `timeMin`/`timeMax` window. Take from each
event: the title (worklog description material), the attendee list, **your own
`responseStatus`** (a declined event is not time you spent) and `conferenceData` - which
carries the Meet URL and therefore lets a Meet window title be matched to a specific
calendar event. That pairing is what makes "window titles only" sufficient for Meet: the
calendar says which meeting, the window title says when you were actually in it, and idle
state says whether you were present.

Because each user registers their own OAuth client, they will see Google's unverified-app
screen and must add themselves as a test user. That belongs in the onboarding flow as an
explicit, documented step, not as a surprise.

**Built** - `libs/timetrack/src/lib/google-calendar/`, all of it through `TimetrackTransport`:

- `client.ts` - bearer auth over the host-supplied access token, `googleCalendarPaged$` following
  `nextPageToken` under a `maxPages` bound, and `GoogleCalendarRequestError`. **No OAuth in the core.**
  The host owns PKCE, the loopback redirect, the keychain and the refresh, and hands the core a token
  that is currently valid - so a 401 is reported as "the host has to refresh", not as a failure.
- `events.ts` - `fetchGoogleCalendarEvents$` into `CalendarOccurrenceEvent`s.
- `calendars.ts` - `fetchGoogleCalendarList$`, for the settings picker. A user has a work calendar, a
  personal one and shared team ones, and which of them count as work is only theirs to say.

What building it settled - four filters that each stop the calendar claiming time nobody spent:

- **An all-day event is dropped.** It has no clock times at all, and `Urlaub` or a company holiday
  would otherwise swallow the entire day. This is the one filter that would do real damage if missed.
- **`transparency: 'transparent'` is dropped** - the user marked that event as free themselves.
- **`eventType` is a deny-list**, not an allow-list: `workingLocation`, `birthday` and `outOfOffice`
  are never worked time, and anything else - including a type Google adds later - reaches the day.
- **A declined invitation is dropped; a tentative or unanswered one is kept as `accepted: false`.**
  Unanswered is the normal state of a meeting people actually attend, so dropping it would lose most
  of a real calendar - it just cannot be trusted the way an accepted one can.
- An event with **no attendee list at all** is one the user created for themselves, which counts as
  accepted. An invitation reaching them through a group alias has attendees but no `self` entry, and
  that is unanswered, not accepted.
- **Google answers a quota breach with 403 as often as 429**, distinguished only by
  `error.errors[0].reason`, so `rateLimited` is computed from both and a genuine scope problem stays
  distinguishable from a retryable one.

**The OAuth flow is built too**, split the way the plan said: `libs/timetrack/src/lib/google-auth/`
holds everything deterministic - the authorization query, `exchangeGoogleAuthCode$`,
`refreshGoogleAccessToken$`, `revokeGoogleToken$` and `createGoogleTokenSource`, which holds one
access token in memory and renews it two minutes before it expires - and `oauth.rs` holds the two
things a webview cannot do. What building it settled:

- **The loopback listener has to build the redirect itself.** The port is only known once the socket
  is bound, so `oauth_authorize` binds `127.0.0.1:0`, generates the PKCE verifier and the `state`,
  appends `redirect_uri`, `code_challenge` and `state` to whatever query the caller passed, opens the
  browser, and reports the code **with the redirect and the verifier** - the token exchange is
  rejected unless it repeats the same pair. Google's own rules for an installed application allow any
  loopback port without it being registered, which is what makes an OS-picked port workable.
- **A browser asks for `/favicon.ico` on its own.** A listener that answers the first request it gets
  ends the flow before the user has consented, so the loop lets any request with neither `code` nor
  `error` pass, and checks `state` before it accepts one that has.
- **`access_type=offline` alone is not enough - it takes `prompt=consent` too.** Google issues a
  refresh token on the first consent for a client and never again, so a re-connect without the prompt
  returns an access token and nothing to renew it with. That reads as a working connection that dies
  within the hour, so the connect flow fails outright on a grant with no refresh token.
- **The token endpoint takes `application/x-www-form-urlencoded` and rejects JSON**, so
  `TimetrackRequest` grew a `form` and `http_request` prefers it over `body`. In reqwest 0.13
  `RequestBuilder::form` is behind a `form` feature, which 0.12 did not have.
- **Disconnecting revokes rather than forgets.** Deleting the stored token would leave the grant
  standing in the user's Google account, which is not what the button says. Revoking a refresh token
  takes the whole grant with it, and a token Google has already forgotten answers 400 - the state the
  call asks for - so the local delete happens either way.
- **Each user registers their own OAuth client**, so the client id is a settings field and the client
  secret is a keychain entry. Google calls the latter a secret; in an installed application it ships
  inside every copy and PKCE is what actually protects the exchange.

The whole browser half is unit-tested through the pieces it is made of - the request-line parse, the
percent codec, and the S256 challenge against RFC 7636's own vector.

Multi-calendar fan-out needed no code here either: `calendar-collector.ts` calls the fetch once per
picked calendar and concatenates. It reads a wide overlapping window every quarter of an hour, so
`CalendarOccurrenceEvent` grew an `occurrenceId` and `dedupeKeyOf` keys an occurrence by it **plus its
times** - a meeting somebody moved is then stored at the hour it moved to rather than keeping the one
it was first read at.

Still unverified: everything past `oauth_authorize` opening a browser. The flow has not been run
against a real Google client yet, so the exchange, the refresh and the revoke have only been driven
against fakes.

### GitLab CE, self-hosted (phase 2)

PAT with `read_api`. The high-value endpoint is `/api/v4/events` scoped to the user with
`after`/`before` - it returns `action_name` and `created_at` for pushes, comments,
approvals and merges, which is a genuine retroactive record of review work that leaves no
local trace.

Review time matters more than usual here: the draft mandates that every sub-feature MR is
reviewed by another developer, so a meaningful share of the day is spent in other people's
MRs. That time currently has no ticket - it belongs on the reviewed Task, and the MR's
source branch name gives that key straight from the grammar.

**Built** - `libs/timetrack/src/lib/gitlab/` (the provider), `correlate/merge-request-activity.ts` (the
rung), `src/collectors/gitlab-collector.ts` (the timer), plus the settings section, the credential and
the sources row. What building it settled:

- **A GitLab event is evidence, never time.** It carries an instant and no duration, so
  `isActivityEvent` excludes it exactly as it excludes a calendar occurrence: letting an approval at
  10:02 open a block would invent the duration, and letting it set the sticky repository context would
  take the real work around it with it. What it does instead is name the issue for the block that _was_
  observed - the browser the review happened in. A review nothing local saw at all stays unbilled,
  which is the honest answer and the same rule as "never silent fill".
- **The activity rung is derived from the stored events, not fetched at read time.** `correlateDay`
  already has the day's events, so it builds the rung itself. That keeps a day read offline - the
  reminder still works on a train - and gives the week view seven days without seven round trips. It
  also retires the wiring the Jira `issue-view` rung never got: the same seam now has a caller.
- **`after` and `before` are exclusive dates.** A query that names the day itself comes back empty, so
  both ends are moved a day out and the instants are filtered afterwards.
- **Only a push says which branch it moved.** A note or an approval names the merge request and
  nothing else, so the branch - which is the whole issue key - needs `/merge_requests/:iid`. It is read
  once per merge request rather than once per event, and the per-run cap is reported rather than
  silently applied.
- **A merge request the token cannot read keeps its events.** They store without a branch and attribute
  nothing, which is strictly better than losing the record that the day was spent somewhere.
- **A merge request title is title-matched like a window title**, for the same reason an agent session's
  is: it is named after the work, and the work is sometimes what a rule exists to keep out.
- **The dedupe key is GitLab's own event id**, so a run may re-read as wide a window as it likes - and
  the first run of a session reads 30 days, which is what makes a week the app was closed arrive.
- **The reviewer list was deliberately not used.** `/merge_requests?scope=all&reviewer_id=…` says what
  is _awaiting_ you and carries no instant, so it can no more place a block than Jira's
  `issueHistory()` can. Both are left out for the same reason.

Still unverified: everything past the request builder. Nothing has run against a real instance yet.

### Gmail (phase 3)

Own OAuth client, `gmail.readonly`, restricted to a query over Jira and GitLab notification
senders. This is the weakest collector in the set: once the GitLab and Jira APIs are wired,
the notification mails are a strictly worse copy of the same events. Its only real edge is
covering systems with no API access. Keep it last, and keep the query narrow enough that the
app never touches unrelated mail.

### Slack huddles (phase 3, live-only)

There is no retroactive huddle API. The observable signal is `users.info` /
`users.profile.get` on your own user, whose profile carries `huddle_state`
(`in_a_huddle` / `default`) and an expiration timestamp; the daemon polls it on an interval
and records transitions. Consequences to state plainly in the UI: huddles are only captured
for days the daemon was running, the boundaries are as coarse as the poll interval, and
`huddle_state` is not a stable documented field - it can disappear without notice. Slack
needs a user token with `users:read`, from the user's own Slack app.

### Discord (phase 3, weak)

Deliberately constrained, because you flagged that not every Braune Digital call is a
meeting. Three possible mechanisms, in descending order of quality:

1. **A bot in the guild** with the `GUILD_VOICE_STATES` intent, running inside the daemon
   and filtered to the Braune Digital guild and your own user id. This gives exact
   join/leave timestamps and the channel name. It requires a server admin to add the bot,
   and a bot token in the local keychain.
2. **Window title + audio state** - which voice channel Discord shows, plus whether the
   process holds a mic stream. No permission needed, and genuinely unreliable.
3. **Discord RPC** over the local `discord-ipc-0` socket - not viable: the `rpc` scope is
   allowlisted per application by Discord.

Using your own user token to read voice state ("self-bot") violates Discord's ToS and is out
of scope regardless of how convenient it looks.

Whatever the mechanism, Discord output is always `weak`: proposed as an unchecked
gap-filler, never synced without an explicit accept, and only inside the configured guild.

## Projects without the grammar

**Built** - `libs/timetrack/src/lib/correlate/rules.ts` and `donate.ts`, plus the two settings
fields and the review UI that writes them. The whole feature is three ideas, and each one exists
because the measured reality above leaves nothing else standing.

**1. An attribution rule is a standing answer, not a learned one.** `AttributionRule` names a
context - a repository, one branch of it, or an application id - and says what work there belongs
to. It is only ever created by the user, and it is visible and removable in settings: a rule keeps
attributing time long after the branch it was written for is gone, and a wrong one nobody can find
is a wrong worklog every day. What building it settled:

- **The rules are two rungs of the ladder, not one.** A rule naming one branch is as good a
  statement about that work as the branch name would have been, so it sits above merge-request
  activity at `likely`. A rule naming a whole repository says only which project the time belongs
  to, which a merge request opened for _this_ branch beats, so it sits below activity at `weak` -
  and `weak` is what keeps a project-wide rule out of a sync nobody reviewed. Collapsing them into
  one rung makes either the narrow rule too weak or the broad one too strong.
- **Naming is per context, never per block.** A day in such a repository fragments into a dozen
  blocks that are all the same work; asking about each is how a reviewer stops reviewing.
  `unnamedContexts()` folds the day's unattributed groups into the contexts behind them, widest
  first, and the review's `Not yet named` list is that. Answering one turns every block in it into a
  worklog - **on this day and on every later one**, because the answer is a setting rather than an
  edit to a day. That is also why no new edit kind was needed: once the context is named the blocks
  become ordinary proposals, and every existing row edit already applies to them.
- **A rule lives in the settings document**, not in a table of its own. It is a handful of
  statements the user wrote, read and written whole exactly like the day target and the deny list.
  `withAttributionRule()` replaces the rule that named the same context rather than adding beside
  it, or which of two rules wins would be their creation order and the user would have no way to
  see which had.

**2. A project with no tickets donates its time.** This repository is the case: real hours, no
tracker, and the work exists _for_ the projects that consume it. A rule can therefore target
`donate` instead of an issue, and `donateBlocks()` hands each such block the issue of the nearest
attributed block in the day. What that settled:

- **It runs after attribution, over the whole day** - which work profited is not a question a
  per-block function can answer, so `attribute` ignores a donating rule entirely and the pipeline
  gains a step between attribute and merge.
- **Nearest in either direction, ties to the later block.** A library is changed _for_ something and
  that something is usually what comes next, but the same afternoon often runs the other way - the
  consumer's work is what turned up the gap in the library. Measured on 2026-08-13: the SDK's
  `createQueryBatch` commits at 16:19 are adopted by `ea-frontend` at 17:23.
- **It is always `weak`.** Which work profited is an inference, and it must not sync unreviewed.
- **A donor with nothing within four hours stays unattributed** rather than being forced somewhere.
  A day that was only library work then reads as unaccounted time, which is true, instead of quietly
  landing on an unrelated ticket. Verified: 2026-08-15 donates nothing, because no consuming project
  was touched that day.

**3. The project keys are a setting.** `issueKeyPrefixes` feeds `gitFlowConfigFor()`, which is the
grammar config the whole pipeline now runs with. Without it anything shaped like a key counts, and a
branch called `chore/angular-22` logs time against issue ANGULAR-22 - the exact failure
`keyPrefixes` exists to prevent, left open for as long as the app passed no config at all.

### The multi-repository day

Working in two checkouts at once is the normal case here, and replaying four real days through the
pipeline found the thing that broke it: **an agent session reports the directory it was started in,
not the repository.** A session opened in `apps/timetrack/src-tauri` became a context called
`src-tauri`, distinct from `ethlete-sdk`, so the day fragmented and a rule for the repository matched
none of it. `sessionize` now takes `repoRoots` - the host's own discovery - and folds a working
directory into the checkout that contains it, longest root first so a repository vendored inside
another keeps its own identity. A directory no known root contains is kept as it is: a session run
somewhere the discovery never walked is still context, and dropping it would lose the branch with it.

Measured on 2026-08-12, before and after: **48 blocks → 21**. The rest of the multi-repository case
needed nothing new - the sessionizer already remembers a branch per repository, and rules are per
repository by construction.

### What four real days look like

Replayed straight out of `git` and `~/.claude/projects` for 2026-08-12 to 2026-08-15, over both
checkouts, with two rules - `ea-frontend` named, `ethlete-sdk` donating:

| Day   | Before               | After                                              |
| ----- | -------------------- | -------------------------------------------------- |
| 08-12 | 21 rows, 14h21m none | 4 rows, all filed                                  |
| 08-13 | 6 rows, 6h08m none   | 3 rows filed, 18m left (nothing within four hours) |
| 08-14 | 4 rows, 6h11m none   | 3 rows filed                                       |
| 08-15 | 4 rows, 1h58m none   | unchanged - no consuming project was touched       |

Two rules turned four unlabelled days into reviewable worklogs, described from the user's own commit
subjects. The replay harness is not committed - it reads this machine's history, so it asserts
nothing - but it is the way to check a change against a real day rather than a fixture.

### Work versus private use

**Built** - `libs/timetrack/src/lib/correlate/project-link.ts`, the `projectLinks` settings field, and
the settings and day-review surfaces that write it. A `TimetrackProjectLink` maps a path to a Jira
project or to `private`. The same editor writes a client's code and a side project's, and no window
title separates them; a path does. What building it settled:

- **A link is not an attribution rule, and the two are separate lists.** A rule says which issue a
  context's time is logged against; a link says whether the time is work at all and which project it
  would be filed in. One repository wants both - linked to `FIP`, and still carrying a branch rule
  naming one issue - which folding them into one list would have made mutually exclusive, because
  `withAttributionRule` replaces whatever named the same context.
- **A private link answers before every rung, including the branch grammar.** It is the user saying
  the time is not work, and a rung above it would make the statement worthless. A side project whose
  branch happens to spell a conforming name is the case that decides this.
- **Private blocks leave before donation, not after proposal.** A repository taken out of the working
  day must not lend its time to the work beside it either, so `correlateDay` splits them out between
  `attribute` and `donateBlocks`.
- **An unlinked path keeps behaving exactly as it did.** The plan's original wording had no link mean
  private, which would silently drop a new client checkout until somebody noticed. Unlinked stays an
  unnamed context the review offers to name; a checkout that vanished without being asked about is
  worse than one row too many.
- **Private time is reported, not hidden.** `DayCorrelation` carries `private` and `privateMs`, and
  the day view names each private path and how long it covered. A reviewer who cannot see that the
  app watched has no way to tell a working link from a broken one - the same promise the pause button
  makes. It counts against no target and reaches no proposal.
- **Longest path wins.** A link on one repository beats the root it sits in, which is what lets `~/dev`
  be private while two client checkouts inside it stay work. Matching stops at a separator, so `dev`
  does not reach `dev-old`.
- **The link is the top rung of `inferTicketProjectKey`.** Both ticket flows made the user type a
  project key that the link already states, so a linked repository now fills the field in the
  retroactive flow and in the Start view.

## Correlation

A pipeline of pure functions over an event window, each independently testable:

1. ~~**Sessionize.**~~ **Built** - `libs/timetrack/src/lib/correlate/sessionize.ts`. Merges
   sub-minute flapping, splits on presence, clamps to working hours when configured.

   One thing the plan had wrong. "Split on idle beyond the threshold" cannot mean a gap between
   samples, because **every phase-1 collector is edge-triggered**: focus fires on a switch, git on
   a commit. Ten quiet minutes inside one context is ordinary work, and treating the gap as
   idleness shattered a real session into zero-length fragments. Idleness has to arrive as a
   presence event from the idle notifier; the gap rule survives only as `maxUnobservedMs`, a
   generous safety valve (30 min) for a stretch nothing observed at all, and it ends the block at
   its last sample rather than stretching it to the next one. Two rules fell out of the same
   fixture work: repo/branch context is **sticky** for `repoStickinessMs` after its last event, so
   glancing at Jira mid-task does not end the block; and adjacent same-context blocks merge only
   when they are genuinely contiguous, so resuming the same branch after lunch stays two blocks.

   **A single sticky repo is wrong when several editor windows are open** - which is the normal case
   here. Focus samples carry only an app id and a title, so alt-tabbing from a window on repo A to one
   on repo B left the context on A's branch until the stickiness lapsed, and never split the block at
   all. The branch is now remembered **per repository**, and a focus title whose own segment matches a
   repository's directory name re-points the current one - `list.ts - fut-frontend - Visual Studio
Code` says which checkout is in front of you. Consequences worth keeping: a focus only re-points
   the repository, never invents a branch, because a branch is only ever learned from git or an agent
   session; matching a whole `-`-separated segment rather than a substring is what stops a page
   title from claiming a repository whose name merely appears in it; and a directory name two
   repositories share is dropped rather than resolved, because guessing which `api` an editor is
   showing would attribute one project's time to another.

   **An agent session is not presence, and reading it as presence cost one real day 7 hours.** Found
   on 2026-08-10, reported by the user: 15h 40m over 34 blocks, one of them
   `feat/collection-item-rejection-tooltip · 7h 14m` starting at 16:15. The mechanism is exact. A
   Claude Code session appends a record per minute for as long as it runs, and the parser emits a
   sample per minute from it. So the `idle-start` at 16:15 closed the block the user left - and the
   agent's next sample, one minute later, opened a new one that no rule could close: never a
   30-minute gap, never a context change, and the user was already idle so no second `idle-start` was
   coming. The evening ran into one block. **From an `idle-start` or a `lock` until the input that
   ends it, nothing the machine does on its own opens or holds open a block** - an agent session and
   a commit both keep happening after the user leaves. Being away ends on `idle-end`, `unlock`, a
   window focus or an editor heartbeat, because all four need somebody at the keyboard; it does not
   end on a commit, or an agent that commits through the night would re-arm presence every time.
   Repo and branch are still learned while away, so a branch the agent checked out is the branch the
   user comes back to. The window's first presence event carries the night: an `idle-end` with no
   `idle-start` before it means idleness began before midnight, which is the same edge `pauseWindows`
   reads a dangling `pause-end` as. Confirmed on this machine that the idle source this rests on is
   live - niri exposes `ext_idle_notifier_v1`. `currentActivity` needed no change and gets better for
   free: the tray said `working` all evening only because the block outlived the `idle-start`.

   **A flap may only be absorbed by a block it touches.** Found while reading the same day. `collapse`
   handed any block under `flapThresholdMs` to the block before it with no contiguity check, so one
   lone sample hours later - a single commit at 14:00 after a morning that ended at 10:00 - stretched
   the morning block across the whole gap. The merge branch beside it always checked contiguity; the
   flap branch now does too, and a flap across a gap is dropped rather than absorbed. It is under a
   minute of unattributable time either way.

2. **Extract keys.** Run the branch-grammar parser over every branch-bearing piece of
   evidence (git checkouts, agent-session `gitBranch`, MR source branches, editor
   heartbeats), then a loose key regex over window titles as a lower-confidence pass.
3. **Resolve through the base.** When a branch yields no key of its own, look at what it
   integrates into: the MR target, or locally the merge-base against the candidate integration
   branches. Because reviewed work lands in an integration branch (today spelled `dev-*`,
   under the grammar `feat/<KEY>-<subject>`), a keyless branch usually has a parent that does
   carry a Story key - so inherit it and leave the Task unknown. This is the rule that makes
   today's flat branch names tractable instead of opaque, and it is deterministic; it stays
   valuable long after the naming settles, because it also covers a conforming sub-feature
   whose local branch was never pushed.
4. **Attribute.** Score candidate issues per block: conforming branch key ≫ partial branch
   key > key inherited through the base > a branch-scoped attribution rule > MR/issue-view
   activity > a repository-wide attribution rule > Tempo history for a recurring pattern (same
   weekday, same ticket) > window-title key. The two rule rungs are the answer for a project
   without the grammar - see **Projects without the grammar** above. Calendar events with a
   matched Meet title and an accepted response become meeting proposals directly - see
   `matchMeetings` below, which is a ladder of its own rather than a rung of this one.

   ~~**Steps 2-4 are built**~~ **- the whole ladder now exists.**
   `libs/timetrack/src/lib/correlate/attribute.ts` runs branch key → merge-request/issue-view
   activity → recurring Tempo pattern → window title, mapping them onto `certain` / `likely` /
   `weak`. Everything a provider supplies arrives **pre-fetched and injected**, the same seam
   `resolveBase` uses, so the core still makes no call: `activity: IssueActivity[]` and
   `patterns: RecurringPattern[]`.

   Two things the ladder's tiers forced. A merge request opened for **exactly this branch** names
   the issue as reliably as the branch would have, so it is `likely`; an issue merely open while
   the block ran is one coincidence away from wrong, so it is `weak`. And the recurring rung is
   not "same weekday, same ticket" as the plan had it - `detectRecurringPatterns()`
   (`recurrence.ts`) also requires a **consistent time of day**. Without that, one standing Monday
   meeting attributes every Monday block to itself; a pair whose starts spread more than
   `maxSpreadMinutes` (120) is a weekly habit, not a slot, and yields no pattern at all. Distinct
   weeks are counted by date, so one busy Monday is one occurrence, not four.

5. ~~**Merge and split.**~~ **Built** - `merge.ts`. Consecutive blocks on the same issue become one
   row, a context switch stays its own row however short it was, and blocks nothing attributed never
   merge with anything - each is a separate question for the reasoning provider, and merging them
   would destroy the evidence that tells them apart. The row cap is a second, more aggressive stage:
   only when a day exceeds `maxRowsPerDay` (12) does every row on one issue collapse into one,
   ignoring the gaps. That is why `WorkGroup.observedMs` exists beside `from`/`to` - a collapsed row
   spans lunch on the clock while its duration still counts only observed time.

   A merged row's confidence is the tier holding **most of its time**, ties to the weaker tier.
   Neither extreme survives review: taking the strongest lets a long weakly-evidenced stretch sync
   unreviewed on the strength of five well-evidenced minutes, and taking the weakest lets a scrap
   drag a whole afternoon into manual review.

6. ~~**Round and check.**~~ **Built** - `round.ts`. `roundDurations()` apportions the day rather
   than rounding each row: every row keeps its whole increments and the leftover increments go to
   the longest remainders, so the day's total survives. Rounding rows independently is what invents
   or loses half an hour over a fragmented day. Two rules the plan did not anticipate, both about
   not losing a row: a row that would round to zero takes one increment from the longest row (the
   total still holds), and a day whose whole total is under one increment still proposes one, because
   a zero-duration worklog is not a thing Tempo can hold. When neither is possible the row stays at
   zero and `checkDay` reports it. `checkDay()` only ever reports - `under-target`, `over-target`,
   `unattributed-time`, `too-many-rows`, `zero-duration` - and never touches a duration.

7. ~~**Describe.**~~ **Built** - `describe.ts`. Commit subjects, then the agent session title, then
   the calendar title, then the branch subject read as words, then the issue key. Building this
   needed one model change: `Evidence.summary` now carries the wording an observation lends to a
   description, next to the `detail` written for the UI - otherwise describing a row means parsing
   `abc1234 feat(user): …` back apart, which is exactly the fragility the two-field split avoids.
   The MR title now sits in that ladder too, between the agent session and the calendar title - it
   describes a whole branch, so it is more general than a commit subject and more specific than a
   meeting name.

8. ~~**Explain.**~~ **Built** - `propose.ts` assembles `WorklogProposal`s carrying the evidence
   chain, the confidence and `observedMs` beside `durationMs`, so review can show what rounding did.
   Proposal ids are `<issueKey>@<from ISO>`, stable across re-runs of a day so an already-synced row
   is recognised rather than duplicated.

`correlate-day.ts` runs the whole chain: `correlateDay({ events })` → blocks, proposals,
unattributed groups and the day check. Still pure - no clock, no network, no filesystem, so the
same events always produce the same day.

Only blocks that reach step 5 with no candidate issue at all go to the reasoning provider - they
come back from `propose()` as `unattributed`, never forced into a row. `unnamedContexts()` compacts
that set into one question per context, which is what the provider is actually asked.

**Meetings are built too** - `meetings.ts`. `matchMeetings()` turns each calendar occurrence into a
row of its own, and `correlateDay` folds those rows in beside the activity groups before rounding, so
the day is one chronological list. What building it settled:

- **A meeting has two separate questions, and the plan conflated them.** _Did it happen_ is answered
  by attendance: `confirmed` (a window title inside the interval names the conference id or the event),
  `observed` (the user was at the machine doing something else) or `unobserved` (nothing was collected -
  which is exactly what a meeting away from the desk looks like, so it is not evidence of absence).
  _Which ticket it belongs to_ is answered by a separate ladder: a key in the event's own title, then a
  recurring Tempo pattern, then a configured `defaultIssueKey`. Confidence is the pair: only a key from
  the event title plus confirmed attendance is `certain`, and an unanswered invitation never rises above
  `likely` however distinctive its title.
- **The conference id is the only string that names _this_ meeting.** Matching the event title as well
  is worth it, but it needs a length floor (6 characters): an event called `QA` matches a window called
  `qa-report.ts`, and a false confirmation is a row that syncs without ever being reviewed.
- **A meeting is logged at the calendar's duration, never at the time the collectors saw.** The
  collectors are edge-triggered, so sitting in one Meet window for an hour emits a single focus event -
  clipping the row to observed samples would throw the meeting away. This is the one place in the
  pipeline where a duration does not come from evidence, and it is deliberate.
- **A meeting overlapping observed activity is time the day proposes twice**, so `MeetingMatch` reports
  `overlapMs` and `checkDay` grew a `meeting-overlap` warning. It only reports: subtracting
  automatically would decide, on the user's behalf, which of the two things they were really doing.
- A meeting nothing can name an issue for comes back **without** one, which lands it in the day's
  unattributed groups - the same first-class path a keyless block takes, and the reasoning provider's
  input rather than a guessed ticket.

### Filling the gaps

**Built** - `fill.ts`, a step between `donateBlocks` and `mergeBlocks`. A day comes up short of its
target across a run of small holes, and the ask was to give a short hole to the work around it.

**What a hole between two blocks actually is.** Measured before writing anything, and it is not what
the ask assumed. The sessionizer closes a block **at the next sample's time** on a context switch, and
a quiet stretch under `maxUnobservedMs` (30 min) never splits a block at all - so a hole cannot be a
few unobserved minutes between two sittings. Replaying 2026-08-12 to 08-15 out of git and the agent
logs confirms it: every gap measured 45 minutes or more, and nothing at all landed under 30. Two
things open a hole, and only two:

1. A stretch of **30 minutes or more with no sample of any kind**, which on a day the window collector
   watched means the machine was untouched.
2. A **presence transition**. The macOS source polls every second and dates `idle-start` at the moment
   input stopped, so the hole runs from the last keystroke to the next one.

So in the running app a gap is a **measured idle period**, never an unobserved one - and the idle
threshold is five minutes. That is what makes the ask right: five minutes without a keystroke is
reading a diff, thinking, or answering the person at your desk, and the work either side of it is the
work it belongs to. Filling holes of the first kind would be inventing time; filling short ones of the
second kind is reading the evidence correctly.

The rule, therefore: **a gap the idle notifier dated, shorter than `maxFillGapMs`, between two
attributed blocks, joins the block before it.** Everything in that sentence is load-bearing:

- **The idle notifier has to have dated it.** Without an `idle-start` inside the gap nothing says
  anybody was at the machine, and the day may simply have run with no window collector - which is
  exactly the replayed case above. The feature then fills nothing, which is the honest outcome rather
  than a failure.
- **A `lock` is never filled**, however short. Locking the screen is a person saying they are leaving;
  going idle is the machine guessing they might be.
- **The block before it, not a split down the middle.** The gap starts at the instant input stopped,
  which is a moment inside the earlier work rather than between the two. Splitting a 12-minute gap
  also produces two six-minute slivers that rounding then has to fight over.
- **Both neighbours attributed.** A gap beside work nothing could name has no ticket to join, and
  handing it to an unattributed block would only inflate `unattributedMs`.
- **Never time another row already claims.** A timer run and a matched meeting each hold a window the
  reconstruction has a hole in - `clipBlocks` cut the timer's out - so a gap overlapping either is
  skipped. Without this the day proposes the same hour twice, and neither `meeting-overlap` nor
  `timer-unobserved` would notice, because both are computed from observed blocks.
- **`maxFillGapMs` defaults to 15 minutes** and is a setting, capped at 30. It is deliberately the
  same number as `maxMergeGapMs`: the gap that merges two rows is the gap that gets filled, which is
  one rule for a reviewer to hold rather than two. It also keeps lunch visible - every real break
  measured on this machine ran 45 minutes or longer.

Where it sits is forced from both sides. It runs **after `donateBlocks`**, because a donating block
only learns its issue there and a gap beside it is not fillable until it has one; and **before
`mergeBlocks`**, because a filled gap is contiguous with the block it joined, so two rows either side
of it collapse into the single row a reviewer wants instead of three.

Two consequences worth stating:

- **Rounding cannot compound it.** `roundDurations` apportions the whole day rather than rounding each
  row, so a filled gap adds its own increments and no more.
- **A filled block is `weak`, and the day says so.** The block carries one `gap-fill` evidence entry
  and the weakest confidence, so a row that is mostly filled becomes weak through the existing
  dominance rule and never syncs unreviewed, while a row carrying a sliver of it keeps the confidence
  its evidence earned. The day-level answer is a `filled-time` warning once the total reaches one
  rounding increment - the same reporting-not-deciding treatment `meeting-overlap` and
  `timer-unobserved` already get.

## The reasoning provider (agent CLI, not an API key)

**Built** - `libs/timetrack/src/lib/reason/`, the last rung of `attribute.ts`, and the ask control on
the unnamed-work card. Locked decision: use the user's existing Claude or Codex **subscription** by
invoking the CLI they already have installed, rather than requiring an Anthropic API key.

The contract held, with two corrections the flags forced:

- ~~**One call per day-review**~~ - one run per _payload_, keyed by a hash of the redacted request
  itself rather than by the day. A collector tick that changes nothing about the question reads the
  answer back; a day whose evidence grew is a new question and asks again.
- ~~**No tools, no filesystem.** Run with `--bare`.~~ - `--tools ""` for the tools, `--safe-mode`
  instead of `--bare`. See below: `--bare` would have broken the locked decision.
- ~~**Redacted payload.**~~ `reasoningPlan()`, with the allowlist in `payload.ts`.
- ~~**Structured output.**~~ `--json-schema` validates the shape in the CLI, and `structured_output`
  comes back already parsed. `parse.ts` still validates, because the schema cannot know which issue
  keys were offered.
- ~~at most `likely`~~ - **`weak`**, so it never syncs unreviewed. See below.

What building it settled:

- **`--bare` cannot be used, and choosing it would have quietly broken the locked decision.** Its own
  help says authentication is "strictly `ANTHROPIC_API_KEY` or `apiKeyHelper` - OAuth and keychain are
  never read", which is exactly the API key this feature exists to avoid. `--safe-mode` is the flag
  that was wanted: it drops hooks, skills, plugins, MCP, custom agents and `CLAUDE.md` discovery, and
  says outright that "auth, model selection, built-in tools and permissions work normally".
- **`likely` would have auto-synced the model's answers.** `syncsWithoutReview` treats everything
  above `weak` as fit to write without a click, so the plan's own cap was one tier too generous. A
  model answer is `weak`, which lands the row in `suggested` and puts it in front of the reviewer -
  no new rule, and no second reason for a row not to auto-accept.
- **A `contextKey` for a repository _is_ its absolute path**, so the payload addresses contexts by
  token (`c1`, `c2`) and maps back locally. Sending the key would have put `/Users/<name>/dev/…` in a
  prompt while the redaction rule two lines above forbade file paths.
- **The redaction is an allowlist of evidence kinds, not a denylist.** A denylist fails open: a kind
  added later joins the payload unnoticed, and `window-title` details are raw window titles.
- **The answer is a rule suggestion _and_ today's attribution.** It enters the pipeline as an
  `InferredAttribution` matched on `contextId` alone - never by scope, so an answer cannot reach a
  context the provider was never shown - and the context stays on the unnamed-work card with the
  suggestion pre-filled. One click turns it into an ordinary user-written `AttributionRule`, which is
  what stops the day from asking again tomorrow. A rule is still only ever created by the user.
- **The day is correlated twice when, and only when, there is an answer.** The provider's own input
  has to come from the deterministic day, or each run would narrow the next one's question.
- **`retry` needs `defer`.** `runner.run$(spec)` is called once when the observable is built, so
  retrying re-subscribed to the first spawn's result and replayed the failure it was meant to escape.
- **The model declines when it should.** Given a 40-minute Slack context with no notes it answers
  `null` with "no notes or branch saying what was discussed", rather than reaching for a candidate.
- **The cache must not also guard the press** (found on a real day, 2026-08-17). `ask()` refused to
  run when the payload's hash was already answered - and that is the same condition that relabels the
  button `Ask again`, so the button could never do anything. The cache still keeps a re-opened day
  from spawning a CLI; only a run in flight refuses a press now. `Ask again` is the reviewer saying
  the answer was not enough, which is the one case worth a second run.
- **A failed run is not an answer, and an answer of nothing has to say so.** `runReasoning$` degraded
  every failure to `[]`, so a CLI that was not logged in cached an empty answer and the day read as
  answered. It now returns `{ answers, failure }`: a failure is reported and never cached, and a run
  that answered no issue for any context says that on the card. Both cases used to look like a button
  that ignored the press.

## Ticket creation

### Retroactive: work → ticket

~~A block with no candidate issue. The app drafts a summary and description from its evidence
(commit subjects, changed paths, repo, agent-session title), searches open issues for
plausible parents - text similarity against summaries, restricted to the project inferred
from the repo, ordered by recent activity - and presents a create form with the parent
pre-selected and editable. On confirm: create the issue in Jira (correct parenting per the
discovered hierarchy), set the story-subject meta field, and attribute the block to the new
key. The Jira field holding that subject is instance-specific and must be configurable; the
draft names the concept but not the field.~~ **- built.** `libs/timetrack/src/lib/ticket/`
(`draft.ts`, `project.ts`, `parents.ts`), the write half in `jira/` (`adf.ts`, `create.ts`,
`candidates.ts`), `TimetrackTicketSettings`, and the form in `src/app/day-review/`
(`ticket-draft.ts`, `create-ticket.component.ts`) behind a Create a ticket button on the
unnamed-work card. 657 core tests. What building it settled:

- **The branch is the best summary there is, even when it carries no key.** `parseBranch` reports the
  subject of a non-conforming name too, so `feat/user-management-screen` drafts as "User management
  screen" - which is what the user called the work while doing it. The ladder falls back to the
  strongest observation, then to the repository, so a draft always has a summary to edit.
- **A parent is offered, never pre-selected.** The plan said pre-selected; it is wrong. The ranking is
  a word overlap, and when nothing overlaps - the usual case - the list is just recency order, so
  pre-selecting would file most tickets under whatever was touched last. The form opens on "No parent".
- **The redaction allowlist is now shared.** A ticket description leaves the machine exactly as a
  prompt does, so `SENDABLE` moved out of `reason/payload.ts` and became
  `QUOTABLE_EVIDENCE_KINDS` in `model/evidence.ts`. Two copies of an allowlist is the failure the
  original comment warns about.
- **A draft quotes the deterministic day, not the reasoned one.** Drafting off `reasoned` would leave
  a context the provider already named with no evidence to quote at all, so `day-review` exports
  `deterministic` beside `correlation`.
- **The project is inferred by a ladder that refuses to guess** - a rule the user wrote about this very
  repository, the single configured key, then the day's own work when all of it sits in one project.
  Two candidates yield an empty field: a ticket cannot be moved by the person who has to explain it.
- **`exhaustMap`, not `switchMap`, on the create.** Jira has no idempotency key, so a second press
  during the call is a second ticket.
- **Description has to be ADF**, and a blank line must be a paragraph with no content: Jira rejects a
  text node whose `text` is empty and fails the whole call with it.
- **Both parenting modes are implemented** (`parent-field`, and an issue link for an instance whose
  levels cannot express the relation), because which one is right is a config value this repo cannot
  answer - see open question 1.

### Prospective: ticket → branch → draft MR

The full-depth flow, per the locked decision. This is the same operation as
`ethlete-agents git-flow start` in `plans/git-flow-system.md` and must share its
implementation, not reimplement it - the app is a GUI over that command. Given a chosen parent
and a summary:

1. Create the Jira issue and read back its key.
2. Compute the branch name from the grammar - nested under the parent Story's feature branch
   for a Task, `feat/<key>-<subject>` off `next` for a Story.
3. Create and check out the branch locally from the correct base.
4. Push it and open a **draft** MR targeting the right branch: the parent feature branch for
   a sub-feature, `next` for a main feature. Link the issue, set delete-source-branch, and
   note the review requirement.

This writes to GitLab, so the blast radius of computing the wrong target is real. Guardrails
that are part of the feature, not polish: show the full plan (base branch, branch name, MR
target) and require confirmation; refuse when the working tree is dirty; refuse to target
`main`; refuse when the parent's feature branch cannot be found on the remote; always draft,
never ready; and make every step individually undoable with the exact commands shown.

**It is built**, as the **Start** view. `planWorkStart` names the branch and decides every refusal;
`executeWorkStart$` files the issue, asks the grammar again with the key it got back, and then runs
the remaining steps in order. What building it settled:

- **The plan has to be shown before the key exists, and the key is what names the branch.** So the
  plan carries `<KEY>` where the key will go, and the grammar is checked against a probe key built
  from the project (`FIP-0`) — the same trick `conformingNameFor` already used, for the same reason:
  a probe with the real project's prefix is not rejected by `keyPrefixes` for a reason the real key
  would never hit. Every refusal that does not need the key is decided up front.
- **The executor re-plans in the middle rather than substituting a string.** `planWorkStart` is a
  pure function of one `WorkStartRequest`, so the form shows `planWorkStart(request)` and the run
  derives the same plan from the same request — what was confirmed and what happens cannot come
  apart. After Jira answers, it asks again with the real key, which is the only place a collision on
  the real name is knowable. A collision there stops the run with the issue filed and nothing local
  touched, which is the cheapest failure available.
- **A Task's parent is resolved by the planner, not the view.** The form picks a parent _issue_, but
  the branch nests under a parent _branch_. Resolving that in the provider would have created a
  second refusal channel beside the plan's, so `featureBranchesFor` moved into
  `@ethlete/agent-rules/git-flow` and the planner calls it: no branch for the story, two branches for
  the story, and a branch that was never pushed are all ordinary refusals now. `git-flow start`'s
  `findParentBranch` calls the same function, as does `nestedSpecFor` for the kind.
- **A parent that only exists locally is refused, not merely warned about.** A sub-feature's base is
  also its merge request target, so an unpushed parent gives GitLab nothing to target and the branch
  would be unreviewable the moment it is created.
- **`Draft:` in the title is the whole draft mechanism.** GitLab's create call has no `draft` field,
  so `draftMergeRequestTitle` owns the prefix and nothing else builds that title. The source branch
  is set to be removed on merge: the grammar makes the name reconstructible, and a stale branch is a
  collision the next start has to refuse.
- **The GitLab token needs `api`, not `read_api`.** Collection only ever read; repair and start both
  write merge requests. The type's doc comment said otherwise and was already wrong when repair
  shipped.
- **An `et-select` bound to `''` reads as a selected value.** `hasValue()` is true for an empty
  string, so the trigger renders an empty label instead of the placeholder and collapses to zero
  height. Bind `null` for "nothing picked".
- **`(blur)` on `et-input` never fires** — blur does not bubble, and the binding sits on the
  component host rather than the inner `input`. The parent search is driven by the typed project key
  through `debounceTime` instead. `create-ticket.component.ts` has the same dead binding; it is
  harmless there only because `open()` searches once.

**MR → ticket repair is built.** A branch with no key gets an issue created, and the branch
and its merge request are then made to conform. It is entered from the day view against a
branch the day observed, right after the create-ticket form reports the new key - the key is
the whole point, so there is nothing to offer before it exists. `planBranchRepair` decides
every step and every refusal against the repository as it reads at that moment;
`executeBranchRepair$` runs the steps in order and stops at the first failure. What building
it settled:

- **The grammar could not name the branch this flow is for.** `parseBranch` leaves
  `suggestedName` unset for a keyless `feat/user-management`, so `git-flow repair` refused it
  and asked for `--to`. The naming step is now `conformingNameFor` in `git-flow/rename.ts`,
  shared by the CLI and the app: it fills a deprecated shape's `<KEY>` placeholder, and falls
  back to rebuilding the name from the parsed kind, type and subject. A candidate is returned
  only after it re-parses as conforming, which also fixes the nested case the CLI would have
  renamed to something still non-conforming.
- **A branch under review cannot be renamed at all.** GitLab cannot move an open merge request
  to a different source branch, and deleting the branch it points at closes it and loses the
  discussion. So repair has two shapes rather than one: a branch nothing is reviewing is
  renamed and its merge requests follow, and a branch that is itself under review keeps its
  name and only its merge request title gains the key. The plan says which shape it is and
  why, and says to rename after the merge request lands.
- **Steps carry a typed action, not just a sentence.** The executor switches on
  `BranchRepairAction`, so changing how a step reads can never change what it runs.
- **The project id needs no configuration.** It is parsed out of the remote URL
  (`parseGitLabRemoteUrl`) and used as GitLab's `:id` in URL-encoded path form, so no numeric
  lookup and no per-repository setting is needed. A remote that is not the configured instance
  yields no merge requests rather than an error - a repository nobody reviews in GitLab still
  has a branch worth renaming.
- **The refusals are decided once, before anything mutates.** A dirty working tree, a
  protected branch, a name already taken locally or on the remote, a branch that is not
  checked out, and a name the grammar cannot spell. A plan carrying any refusal runs nothing,
  and the executor re-checks that rather than trusting the caller.
- **The e2e fixture's keyless branch changed** from `spike/pdf-export` to `feat/pdf-export`.
  `spike` is not a known type, so the grammar could not spell it and repair correctly refused
  it - which made it useless as a fixture for this flow. The two create-ticket assertions that
  named it moved with it, and the drafted summary is now `Pdf export` (from the branch
  subject) rather than the commit subject fallback.

## Review UI

Tray presence plus a day view, built with `@ethlete/components`.

**The styling foundation is in place.** The app registers its own colour and surface themes
(`src/themes.ts`, `src/surface-themes.ts`) through the repo's own Nx generators, so every component
resolves `--et-surface-*` / `--et-theme-color-*` and the whole app follows `prefers-color-scheme`
without a line of media-query code. Tailwind is imported in `src/styles.css` with a trimmed `--text-*`
scale on the 10px rem base; utilities are for app templates only, never component source. Two traps:

- **Do not keep the generators' `.d.ts` output.** It narrows the theme-name registry, which is a
  nice-to-have for a consumer compiling against built `.d.ts` files, but in this repo the app compiles
  `libs/components` and `libs/core` from source through tsconfig paths - and neither is written
  against a narrowed registry, so ~20 files fail, including the app's own theme definitions. Delete
  the two `.d.ts` files after generating; the playground ships none either.
- **A surface theme's colours are template-literal types.** Extracting a shared
  `interactionColor` to a `const` widens it to `string` and stops compiling; annotate it
  `SurfaceInteractionColor`.

The tray shows current activity and today's total, and carries the start/stop timer for the
explicit half of the hybrid model. Two Wayland realities to design around rather than
discover later:

- The tray is a StatusNotifierItem and needs a host. On `niri` that means a bar that
  implements SNI (waybar and friends). **The tray must therefore not be the only way in** -
  ship a `timetrack open` CLI that focuses the running instance via
  `tauri-plugin-single-instance`, so the user can bind it in their compositor config.
- `tauri-plugin-global-shortcut` does not work on Wayland; there are no global grabs. Do not
  promise a global hotkey - the compositor binding plus the CLI is the answer.

**Closing the window hides it** (`src-tauri/src/tray.rs`): the collectors are the point of the app, so
the window is a view onto a daemon rather than the daemon itself. The tray menu carries `Show
Timetrack` and `Quit`, and `Quit` has to stay there - it is the only way out once close no longer
exits.

**The readout is two menu entries, not a tooltip or a title.** `tray_set_readout` writes them and
`src/app/tray-readout.ts` pushes them - the current activity (`review/now.ts`'s `currentActivity`,
where a presence event newer than the last observation beats the last block, because naming the branch
someone walked away from as current work would be a lie) and the day's total. Three things this
settled:

- `TrayIcon::set_tooltip` is **unsupported on Linux**, and `set_title` draws into the panel itself,
  where it costs every other tray icon the space it takes. The menu is the only portable place a
  readout fits. Verified without touching the screen: the menu is a `com.canonical.dbusmenu` object,
  so `busctl --user call <conn> /org/ayatana/NotificationItem/tray_icon_tray_app_main/Menu
com.canonical.dbusmenu GetLayout iias 0 -- -1 0` prints every label the bar would draw.
- **The total has to name the unattributed time too.** On a machine whose branches carry no issue key
  the day proposes nothing, and a tray reading `0m` looks like broken collection rather than like nine
  hours that matched no ticket.
- The readout reconstructs today itself instead of reading the day review's, which follows whichever
  day the reviewer stepped to. A tray reporting last Tuesday is worse than one reporting nothing.

**`timetrack open` is the binary run a second time.** `tauri-plugin-single-instance` - registered
first, before every other plugin - hands the argv to the running instance and exits, and the callback
reveals the window. It registers `io.ethlete.timetrack.SingleInstance` on the session bus, which is
also how to check it is live without focusing anything. A `#[tauri::command]` generic over `R:
Runtime` cannot infer `R` from a `State<'_, Readout<R>>` alone; it needs an `AppHandle<R>` parameter,
and then `try_state` rather than `state` - a desktop that gave us no tray icon has no readout to
write, which is not an error the webview can act on.

**The start/stop timer is the explicit half of the hybrid model**, and the thing that made it a design
question rather than a button is what a run does to the reconstruction under it. Starting a timer and
then working means the collectors see the same hour the run already claims, so the two together
propose it twice. A run therefore **displaces** what is underneath: `clipBlocks` cuts the run's window
out of the sessionized blocks before anything is attributed from them, splitting a block the run falls
inside of and leaving each piece only the evidence observed in it. What survives:

- **A run's duration is its own, never the time observed inside it.** The machine sees nothing during
  an hour at a whiteboard, and that hour is exactly what a timer is for. The observed time is kept
  anyway, as `TimerMatch.observedMs`, and a run with almost none of it raises `timer-unobserved` —
  a forgotten timer is the one way an explicit timer invents time.
- **A run carries no issue key until the user names one**, which leaves its row unattributed. That is
  why the review has a `Timed by hand` list (`day-review/timer-runs.component.ts`): a run nobody has
  named proposes nothing, so it would otherwise be visible only as a warning about time it cannot
  account for. Naming it there is what turns it into a worklog.
- **An open run is closed at now, or at the end of the day being read, whichever comes first.** Closing
  it at the day's end would hand a timer that is still going every hour left until midnight.
- **At most one run is open, and the database is what enforces it** — `CREATE UNIQUE INDEX … ON
timer_run (stopped_at_ms IS NULL) WHERE stopped_at_ms IS NULL`. The index has to be over the
  expression: SQLite counts NULLs as distinct, so a unique index on the column itself constrains
  nothing. Starting a run closes the open one first, so a forgotten timer cannot overlap its successor.
- **The tray entry emits; the webview acts.** `tray.rs` emits `timer-toggle` and `src/app/timer.ts`
  owns the run, because the webview is what knows the store and the day. The whole loop can be driven
  without touching the screen: `busctl --user call <conn> <menu path> com.canonical.dbusmenu
AboutToShow i 0` followed by `… Event isvu 5 clicked s "" $(date +%s)` picks the entry and the next
  `GetLayout` shows the label flipped. A bare `Event` with timestamp `0` is ignored — send `AboutToShow`
  first.

**The window draws its own controls** (`decorations: false`, `src/app/window-controls.component.ts`).
They sit in a titlebar band of their own at the top of the shell, sticky and opaque, which is also
the drag region (`data-tauri-drag-region="deep"`, which excludes buttons and maximises on
double-click). The band was first folded into the app header to avoid a GTK-grey strip above a dark
app; with `decorations: false` that strip is our own markup on the app's own surface tokens, so the
objection did not survive contact - and a titlebar has to stay reachable however far the day is
scrolled, which a header does not. What building it settled:

- **Ask the compositor which controls to draw.** `src-tauri/src/decorations_wayland.rs` creates an
  `xdg_toplevel`, reads its `wm_capabilities` and destroys it without ever attaching a buffer, so it
  is never mapped and never flashes on screen. niri advertises maximise and fullscreen but not
  minimise - and GTK was drawing a minimise button regardless, which is the argument for asking.
- **Silence means everything, not nothing.** `wm_capabilities` only exists from xdg-shell 5; a
  compositor below that, or no Wayland socket at all, has to fall back to all capabilities.
- **`core:default` is not enough.** It grants the window reads and `internal_toggle_maximize` (so
  double-click works on its own), but `close`, `minimize`, `toggle_maximize` and `start_dragging` are
  each an explicit `core:window:allow-*` in `capabilities/default.json`.

The day view is a timeline of blocks beside an editable worklog list. Each row shows issue,
duration, description, confidence and an expandable evidence chain; weak rows are visually
distinct and unchecked. Editing is local and immediate - change the issue, split a row, merge
two rows, retype a description, drag a boundary. The footer shows proposed total vs target
vs already-in-Tempo, and the sync button opens the diff preview. An end-of-day nudge fires if
a day is unreviewed, and a week view lists unreviewed days for catching up.

The **settings screen** carries the reminder: whether it runs at all, and the local time it is due
(17:30 by default). It also sends a test one, which is the only way to find out whether this desktop
shows notifications at all.

~~Local edits always win over re-correlation: re-running the engine on a day must never
silently discard a row you touched. Mark edited proposals and merge around them.~~ **Built** -
`libs/timetrack/src/lib/review/` holds `DayReviewEdits` and `reviewDay`, and
`apps/timetrack/src/app/day-review/` the view (schema v2's `day_review` table persists the edits, one
JSON document per local calendar day, keyed by `localDayKey`). What building it settled:

- **Store the edits, never the engine's rows.** Two kinds of edit, because they reconcile
  differently: a **field override** keyed by proposal id (issue, description, duration, accept/reject),
  and a **pinned row** for a split or a merge, which records the proposal ids it `replaces` so those
  are dropped from the next correlation rather than re-appearing beside it. `proposalId` is
  `issueKey@from`, and a live day only ever grows forward, so the key is stable while the row's `to`
  moves.
- **Re-correlation can still find _more_ time under an edited row**, and that surplus is reported as
  `unreconciledMs` with an `edited-row-drift` warning rather than folded in. Silently absorbing it
  would move a number the reviewer had already decided; dropping it would lose real time.
- **A rejection has to survive being restructured.** Splitting or merging a rejected row keeps it
  rejected (a merge only if _every_ side was), or reshaping a row somebody threw out quietly puts its
  time back into the sync. Everything else re-reviews as `edited`.
- **Confidence decides the default checkbox, not a separate flag.** An untouched `certain`/`likely`
  row reviews as `accepted` and a `weak` one stays `suggested`, which lines up exactly with the states
  `planTempoSync` writes - so the footer's total and the sync are reading the same rule
  (`syncsInState`, moved to `model/proposal.ts` and now shared with the Tempo diff).
- **Reset undoes a whole split, not one half.** The other half still claims the original proposal, so
  resetting one side alone would hide the row and turn its time into drift.
- **The timeline is the scheduler's headless time grid** (`[etSchedulerTimeGrid]`), not hand-rolled
  geometry: it brings the hour axis, the overlap packing that a fragmented morning needs, and
  `initialScrollHour` so a 24-hour grid does not open on an empty midnight. The full `<et-scheduler>`
  was wrong here - its toolbar carries a month/week switch, and only one day's events are loaded - and
  a bare `[etScheduler]` composition cannot render badge content, because only `SchedulerComponent`
  provides `SCHEDULER_FEATURE_HOST`. Rows paint in their confidence's theme via `colorToken`;
  unattributed blocks sit behind them in neutral, because the time was still spent.
- ~~**Still owed here:** dragging a boundary.~~ **Built** - `moveRowBoundary()` in
  `libs/timetrack/src/lib/review/edits.ts`, and the handles the day timeline draws between adjacent
  rows (`apps/timetrack/src/app/day-review/day-timeline.component.ts`). The day target is now a
  setting, and the footer and the tray read the same one. What building it settled:
  - **The drag moves a boundary; it does not create one.** Halving a row is still what makes a cut,
    and dragging is what places it - together they reach any instant, which is the whole gap the
    halving left. So the handle only ever sits where two rows already meet, and a pair with no shared
    instant has nothing to drag.
  - **The slice that crosses carries the density of the row it left.** Re-deriving both sides from the
    pair's average - the rule `splitRow` uses, because one row is all it has - would flatten a sparse
    afternoon into a busy morning the moment somebody nudged the boundary between them. The pair's
    clock span, observed time and logged total are unchanged either way.
  - **Neither side is merged into the other.** Each keeps its own issue, description and decision, and
    each replaces its own proposal, so resetting one leaves the other alone. That is the opposite of
    `mergeRows`, where the first row deliberately supplies both.
  - **The boundary snaps to the rounding increment, not to the pixel.** A row reading 09:07 whose
    duration rounded to the quarter hour is claiming a precision it does not have.
  - **The grid still has no drag, and did not need one.** `dragGestureFrom` from `@ethlete/core` is
    the primitive under `<et-scheduler-time-grid-view>`'s own drag, and the timeline draws its own
    blocks, so the handle is a `role="separator"` of ours over the headless grid rather than a reason
    to adopt the full view. Arrow keys move it by one increment, because a 2px line is not a target
    everybody can hit.
- ~~**An end-of-day nudge fires if a day is unreviewed.**~~ **Built** - the core's
  `dayReviewGap()` / `dayNudge()` (`libs/timetrack/src/lib/review/nudge.ts`), the host's `notify`
  command over schema v7's `day_nudge` table (`src-tauri/src/nudge.rs`), and
  `apps/timetrack/src/app/day-nudge.ts`
  with the banner beside it. What building it settled:
  - **"Unreviewed" is answered against the local ledger, never against Tempo.** The ledger holds the
    `contentHashOf` every worklog this app wrote, so a row it does not hold - or holds under a
    different hash - is a row Tempo is behind on. That is what lets the reminder work on a train, with
    no token and no request, and it is the same hash `planTempoSync` diffs with, so the two can never
    disagree about what is written. A day also owes something while a row waits for a yes or a no,
    while observed time matched no issue, or while the ledger holds a worklog no row claims any more -
    that last one is a delete the day owes Tempo, and reading the ledger per day is what surfaces it.
  - **The reminder and the notification are two questions, not one.** `isNudgeDue` asks whether the
    day may be reported at all (the configured minute has passed, and no "later" is running); the
    repeat window is a second question that only the desktop notification asks. A banner that blinked
    out for an hour after firing would tell a user who is looking at the app that the day is finished.
  - **The record is written before the notification is sent.** A failed write would otherwise leave the
    day looking un-reminded, and the next tick would send the same notification a minute later, and
    every minute after that - the same ordering argument as the pause, for the same reason.
  - **A pause does not silence it.** A hard pause is a promise that nothing is _collected_; a day that
    was paused at 16:00 still has a morning nobody has logged, and the two controls must not be wired
    into each other.
  - **The reminder is only ever about today.** A past day is caught up in the week view, and a machine
    that was asleep at the configured minute has nothing to be told at 03:00.
  - **A day is now read in one place** (`apps/timetrack/src/app/read-day.ts`): the tray readout, the
    reminder and the week view all read a day they do not own, and a second copy of the
    correlate-and-review call would have been the one that drifted. `readToday$` is `readDay$` on
    today's key.
  - macOS delivers it under the terminal while the app runs unbundled, because a binary with no bundle
    has no identity to post under. The plugin does that itself; a packaged build posts as the app.
- ~~**A week view lists unreviewed days for catching up.**~~ **Built** - the core's `reviewWeek()`
  (`libs/timetrack/src/lib/review/week.ts`) and the `week` route
  (`apps/timetrack/src/app/week-review/`). It reads each of the seven days through the same
  `dayReviewGap` the reminder reads today through, so the two can never disagree about which days are
  finished. What building it settled:
  - **The week targets only the days that saw work.** A weekend nobody worked is not a shortfall, and
    a week target of five fixed days would report every holiday as one. `worked` is true when the day
    proposed something, observed time nothing could attribute, or holds a row at all - a day whose
    rows all await a yes or a no proposes nothing yet and is still a day that was worked.
  - **A week nothing was collected in is not a finished week.** The list would otherwise read as green
    for a week a collector was dead in, so the empty week says so and points at the Sources view.
  - **The wording of a gap lives in the core** (`describeDayReviewGap`), because a day now says what it
    owes in three places - the notification, the banner and this list - and one sentence in three
    places is one sentence that drifts twice.
  - **Scoped to its view, not to the root.** Seven correlations are worth running while somebody is
    looking at them and not on every app start, which is why this is the app's one `defineProvider`
    rather than another `defineRootProvider`.
  - **A row's Review link steps the day review and then navigates.** The day store is a root provider,
    so the day view is already on the right day when it loads.
- ~~**A control inside `<et-form-field>` needs a projected `<et-label>` or the `aria-label` _input_.**~~
  **Fixed.** `[attr.aria-label]` sets the attribute on the wrapper, not on the native control the
  directive renders, so the row had no accessible name and `ET2201` threw in dev mode. The review rows
  now bind the `aria-label` _input_, and `et-duration-input` - the one control that did not re-expose
  `aria-label`/`aria-labelledby` from its host directive - now does.

### The shell: a sidebar and one view per route

The single scrolling page stopped working once the sync preview joined it, so the app is now a
routed shell: a sticky rail beside `<router-outlet />`, one lazy view per route
(`day`, `sync`, `sources`, `settings`, `host`), each still one `et-card`. Routing is
**hash**-based - the bundle is served as static files off `tauri://localhost`, and a path route
would 404 the moment the webview reloads on it. The stores are `defineRootProvider`s, so day
state, settings and the tray readout all survive navigation; only the views are lazy.

#### The floating readout: a second window, one bundle, no second collector

**Built** - `apps/timetrack/src/app/widget/`, `src-tauri/src/widget.rs`. Always on top, 340×148, and
it says four things: what is being recorded, the issue it would go to, how sure of that the day is, and
the day's total against its target. It carries the pause button and a way back into the app, which is
what makes it the replacement for the tray menu on a desktop whose bar hosts no tray.

What building it settled:

- **A second window must not be a second app.** Everything `AppComponent` starts on boot - the window,
  git, agent-session, calendar, GitLab and ingest collectors, the tray readout, the day nudge - would
  start again in a second webview, and two of them collecting would write every event twice. So the
  widget has a root and a provider set of its own (`widget.config.ts`): the themes, and nothing else.
- **One bundle, two roots, picked by the window's label.** A second entry point would mean a second
  build and a second `index.html` for one small window. `isWidgetWindow()` reads
  `getCurrentWindow().label`, which is set by the Rust builder, so nothing has to be passed in a URL.
  **Both root elements have to stand in `index.html`**: a `bootstrapApplication` whose selector matches
  no element renders a blank window and logs an error into a console nobody can open - which is exactly
  how the first version failed.
- **The widget computes nothing; the app window publishes.** The app window already reconstructs today
  every minute for the tray, so it emits the same reconstruction as a `widget-readout` event and the
  widget renders it. Two windows correlating the same day would double every read and could disagree
  about the same minute. A widget that opens between two changes asks for the current one
  (`widget-ready`), so no state has to be kept for it anywhere.
- **The confidence is worded, not shown as a label.** `weak` reads as "a guess" and `certain` as "the
  branch names it", because the point of the window is to be glanced at. Work no row claims says so
  outright rather than showing an empty issue field - `currentAttribution` (`review/now.ts`) answers
  `null` for it, which is a different thing from a weak guess.
- **A tiling compositor decides where it goes, and that is not a bug to fight.** The window asks for
  `always_on_top`, no decorations, no taskbar entry and the bottom-right corner of the primary monitor.
  niri tiles it anyway; it needs a window rule, which is why the widget carries the distinct title
  `Timetrack readout`:

  ```kdl
  window-rule {
      match title="^Timetrack readout$"
      open-floating true
  }
  ```

- **The widget gets its own capability** (`capabilities/widget.json`), because Tauri scopes permissions
  per window label and the app's is scoped to `main`. It may close itself and be dragged; it gets
  neither minimize nor maximize, since it has one size and hiding it is what closing it means.

The **sync view** (`apps/timetrack/src/app/sync/`) plans on demand, and writes only when the reviewer
presses the write button. It is deliberately not reactive to the day's rows: a plan is a statement
about a moment, and one that re-planned itself while the reviewer edited would read as if Tempo were
changing. Stepping to another day drops the plan and the run rather than showing yesterday's under
today's date. The write half is one `submit()` for both the confirm and the retry, so the
spent-plan rule cannot be bypassed by the retry path.

~~What it cannot yet see: a ledger entry whose proposal the day no longer produces - `entriesFor$` is
keyed by the proposal ids under review, so such a worklog reads as `foreign` instead of as a delete.~~
**Closed - the ledger is now read by day** (`entriesForDay$`, schema v8's `day` column). A worklog
whose proposal the day stopped producing - a row somebody rejected and then reset, a block whose start
moved, a rule that renamed the issue - was written by this app, is still in Tempo, and nothing could
ever name it again. `planTempoSync` already planned it as a `proposal-removed` delete; the read was
what never handed it over. What closing it settled:

- **The day is the ledger's key, not the proposal.** Every surface that asks the ledger anything asks
  about one day, and the id-scoped read could only ever answer with what the day still proposes -
  which is the one set of worklogs that needs no rescuing. `entriesFor$` is gone rather than kept
  beside it, so the question that caused this cannot be asked again.
- **The day has to be stored, because it cannot be derived on the host.** A proposal id carries a UTC
  instant and the day is local, so v8 adds the column and back-fills it in Rust, from the instant in
  the id and, failing that, from when the row was synced. An entry left without a day would be
  invisible to the very read that was added to find it.
- **The reminder and the week view were blind to it too.** `dayReviewGap` walked the rows, so a day
  whose only remaining work was a delete read as finished. It now reports a ledger entry no row
  claims, which is the same question `planTempoSync` asks, and the wording covers both cases.
- **The preview was reading two days.** `localDayRange(day).to` is midnight of the day _after_, and
  Tempo's range is inclusive by date, so the next day's worklogs arrived in this day's foreign list.
  Taking the day itself rather than a range removed the chance to disagree.

**A day now counts what Tempo already holds against its target.** The first real day the review was
opened on read `0m proposed against a 8h target` while Tempo held ten hours for it, logged by hand -
and it was not a rounding error but the definition: `checkDay` compared its own proposals with the
target, and a day logged by hand proposes nothing, because every row is reduced to zero by the same
foreign time. `checkDay` now takes `coveredMs` and reports `coveredMs` and `loggedMs`; `reviewWeek`
totals the same. Three things this settled:

- **The record had to be readable without planning a sync.** `TempoDayCoverage` existed, but only
  `previewTempoSync$` ever wrote one, so a day nobody had previewed had none - which is every past day.
  `fetchTempoDayCoverage$` is the read on its own: the account, the day's worklogs, and the keys behind
  the ids Tempo names. Ownership still comes from the ledger, so what this app wrote stays out of the
  record and is not counted twice.
- **A stored record is trusted when it was observed after its day ended.** Nothing more lands in a day
  that is over, so a past day is read from Tempo once, ever. Today's is re-read on every open, because
  the rest of today has not happened. Time added to a past day afterwards is the case this misses on
  purpose - `Re-correlate` forces the read.
- **A failed read leaves the day exactly as it was.** No token, an expired one or no network yields
  `null` and the old wording. Tempo is an extra here, not the day.

**`HEAD` is not a branch.** A third of a real day read as blocks labelled `HEAD`: `git rev-parse
--abbrev-ref HEAD` answers `HEAD` in a detached checkout and Claude Code writes that answer into
`gitBranch` - 13,226 records on this machine, all in the home directory and NAS app folders. Git
refuses `HEAD` as a branch name, so it never names one, and the parser now drops it exactly as
`parseGitReflog` drops a bare object name. The timeline label leads with the checkout for the same
reason: `next` is a branch in most repositories here, so `ethlete-sdk · next` identifies work that
`next` alone does not.

**A standing answer that changes nothing has to say so.** `No tickets here` writes a donating rule,
and `donateBlocks` hands a donor's time to attributed work in the same day - so on a day with none, the
context comes back unchanged and the button reads as broken. The naming card now shows the rule that
covers a context and why it is still listed, and offers to take it back.

**The window reopens where it was left** (`src/app/view-state.ts`): the view, the day under review and
the week. `localStorage` rather than the encrypted store, because it answers synchronously - the empty
route redirects straight to the remembered view, so the default one is never painted first - and
because a route name and two calendar days are not observations.

**The ticket draft was written for the app, not for the person who reads it.** On the first real day
it was used, the card offered `Reconstructed from 21m of work in fut-frontend @ feat/hub-review-feedback`
as a description, a free-text project field holding a guessed placeholder, and `No parent` with no list
under it - which is a form that asks the reviewer to do the work the app was built to do. What the fix
settled:

- **The project is picked, not typed.** `fetchJiraProjects$` (`jira/projects.ts`) reads
  `/rest/api/3/project/search` ordered by `-lastIssueUpdatedTime`, so the project the user has actually
  been in is at the top of the list. The list is read once per session and kept - an instance's projects
  do not change while a day is reviewed. It falls back to a typed key when the read fails, because a
  failed read must not be the thing that stops a ticket from being filed. Picking a project re-reads the
  parents under it and clears the parent already chosen, which is what made `No parent` the only option
  before: the parents were only ever read for the key the guess produced, and an empty guess read none.
- **A description leads with the work and ends with the provenance.** Where the time came from is the
  least interesting line for a reader who was not there, so it goes last. This is a better draft, not a
  good ticket - the honest fix is that a person writes it, and nobody is going to.
- **So the agent writes it.** `writeTicketWithAgent$` (`ticket/write.ts`) is a second one-shot call to
  the same local CLI the day's reasoning uses, with the same isolation flags, the same redaction (a
  repository's name, never its path; only `QUOTABLE_EVIDENCE_KINDS` wording) and the same payload
  disclosure before the press. It fills the two fields and files nothing. A run that fails answers
  `null` and leaves the deterministic draft standing, which is worse wording and no less correct.
- **Both calls now share one seam.** `agentProcessSpec` (`reason/spec.ts`) holds the isolation flags and
  `agentOutputDocument` (`reason/envelope.ts`) reads the CLI's JSON envelope for any schema. A third
  question asked of the agent should add a prompt and a schema, nothing else.

**Every field of the card is now a question the app tries to answer first.** What the first round left
the user doing by hand, and what each answer rests on:

- **Both pickers are searchable** (`input etSelectSearch`). A project list is 40 entries long and a
  parent list is 30, and a picker that long without a search is a scroll, not a choice.
- **The parent fills itself in when the ranking is sure.** `suggestParentKey` (`ticket/parents.ts`)
  takes the leader only when it shares at least 0.3 of its wording with the draft _and_ leads the
  runner-up by 0.1. A leader that only just wins is a coin toss, and a coin toss pre-filled reads as a
  decision somebody made. It fills only while nothing is chosen, so a pick made during the read stands.
- **The duplicate is the expensive mistake, so it is checked before the ticket is written.**
  `matchExistingIssues` ranks every open issue in the project against the draft and offers the ones
  over 0.4 as "this work may already have a ticket", each with a `Log on <key>` button that writes the
  same standing rule a creation would. Filing a second ticket puts the time on a key nobody is watching
  until another person notices, which is a cost this app cannot see and its user does not pay.
- **The agent answers the same three questions.** `writeTicketWithAgent$` now takes `parents` and
  `issues` in its payload and answers `parentKey`, `existingKey` and `existingReason` beside the
  wording. A key the payload never offered is dropped, exactly as `parseReasoningOutput` drops an
  invented issue key — a model that answers outside the list is not to be trusted with that field.
- **Two reads, not one filtered afterwards** (`fetchJiraOpenIssues$`, `fetchJiraParentCandidates$`).
  The parents are the 30 most recently updated of the parent types; narrowing a 100-issue window of
  open issues down to those types would offer fewer parents the busier the project is.

## Storage, privacy, secrets

**The core half is built** - `libs/timetrack/src/lib/store/`: the two persistence ports, the
exclusion rules, the retention plan and the ledger writer (22 tests). No encryption is in it and
none belongs there: the key lives in the OS keychain and the cipher in SQLCipher, both host-side,
so the core holds the seam and the policy the host runs around it - nothing that touches a file.
`TimetrackEventStore` moved out of `transport/ports.ts` (a store is not a transport) and gained
`append$`, `deleteEventsBefore$` and `oldestEventAt$`; `TimetrackPorts` gained `ledger`.

**An append is idempotent where the observation has an identity** (schema v3). `dedupeKeyOf`
(`store/dedupe.ts`) keys a commit by repository and sha and a checkout by repository, reflog instant
and branch; a unique index on the column and `ON CONFLICT DO NOTHING` drop the repeat, and
`events_append` reports how many rows were actually new. This is what lets a collector read a window
of history instead of a stream - the git scan could not otherwise overlap itself, and without
overlapping scans nothing reconstructs the days the app was closed for. Two rules it rests on:
SQLite treats NULLs as distinct, so a focus sample - two identical ones a minute apart are two real
observations - keys to `null` and is always appended; and a commit keys by its sha **alone**, so the
branch the first scan reported for it stays, because `%S` names whichever ref reached it first and a
commit that later also lives on another branch is not a second piece of work.

- **Encrypted SQLite.** ~~`rusqlite` with bundled SQLCipher, key generated at first run and
  stored in the OS keychain (`keyring` crate; `tauri-plugin-stronghold` as the alternative).~~
  **Built** - `apps/timetrack/src-tauri/db.rs` holds the schema and `PRAGMA key`, `keychain.rs`
  generates 32 random bytes into the OS keychain on first run. `tauri-plugin-sql` remains the wrong
  choice: it uses sqlx without SQLCipher. Three things the plan did not know:
  - **`PRAGMA key` must be the first statement on the connection.** Anything before it runs against
    an unkeyed database and permanently confuses SQLCipher about the file's header. The open path
    then reads `sqlite_master` purely to make a wrong key fail loudly instead of at the first query.
  - **The `bundled-sqlcipher-vendored-openssl` feature needs the full `perl` package**, not the
    `perl-FindBin` the first failure names. Fedora may only have `perl-interpreter`, its minimal perl,
    and OpenSSL's `Configure` reaches all over the standard library - `FindBin`, then `IPC::Cmd`, then
    `Time::Piece`, and on. It aborts on the first module it misses, so installing them individually
    costs one full build per module and never converges; install `perl` and be done. (`perl-core` is
    not a Fedora 44 package.) Vendoring is still right - linking the system OpenSSL means every
    machine needs its own `OPENSSL_DIR`, macOS worst of all, where there are no headers to point it at.
  - **`keyring` v4 renamed every backend feature** (`zbus-secret-service-keyring-store`,
    `apple-native-keyring-store`, …) and enables the Linux and Windows ones by default, so the
    backends have to be selected per `[target.'cfg(target_os = …)']` or a macOS build drags in dbus.
- **Retention.** ~~Raw `CollectedEvent`s expire on a configurable window (default ~30 days)
  after which they are compacted to attributed blocks and deleted.~~ **`planRetention` decides
  this**, and its one load-bearing rule was not in the plan: the cutoff is clamped to how far
  compaction has got, because blocks are what outlive the events and deleting an uncompacted day
  destroys it. Nothing compacted yet means nothing is deletable. Synced worklogs and their
  evidence summaries persist.
- **Exclusion rules.** ~~Deny by app id or window-title regex, evaluated before persistence.
  Ship sensible defaults (password managers, banking, private-browsing windows) and make the
  list visible and editable in settings.~~ **`applyExclusionRules` + `DEFAULT_EXCLUSION_RULES`.**
  Two things it settled: an excluded event's summary carries its timestamp, source and the rule
  that fired but never its title or app id, so a denied window title cannot reach the database by
  the back door; and a rule whose regex will not compile is reported in `invalidRules` rather than
  thrown - a typo in settings must not stop collection - which means the settings screen has to
  show them, or the user trusts a rule that is protecting nothing. The defaults are not composed
  in for you: `rules` is required, and the host decides whether the user's list replaces or extends
  them - `effectiveExclusionRules` is where that decision now lives, and `keepDefaultExclusionRules`
  is the switch. **The editable list is built**; see the settings screen below.
- ~~**Hard pause.** One click stops all collection, visibly, until resumed. Not a filter - the
  collectors stop.~~ **Built** - `src-tauri/src/pause.rs`, `src/app/collection-pause.ts` and the
  core's `pauseWindows()`. What building it settled:
  - **The state is host-side and read before the samplers start** (schema v6's `collection_pause`).
    A pause the webview had to load in order to apply would collect the first seconds of every
    restart, which is the one thing a pause promised not to do.
  - **The source stops before the pause is recorded, and starts after the resume is recorded**, and a
    write that fails puts it back. Either order the other way round leaves a sample dated inside a
    stretch the record claims nothing watched.
  - **The transition is an ordinary presence event** (`pause-start` / `pause-end`, source `idle`),
    written in the same transaction as the state row. That is what makes a pause reconstructible: the
    day is rebuilt from events, so a pause only the collectors knew about would be a hole the
    sessionizer bridges and the day bills. The core reads them back with `pauseWindows()`, which
    closes an open pause at a caller-supplied `through` exactly as an open timer run is closed.
  - **The pause displaces the reconstruction, like a timer run**: `clipBlocks` cuts the window out
    before anything is attributed, and the windows join `fillGaps`' `claimed` so no gap a pause
    reaches into is filled. `checkDay` reports `pausedMs` as a `paused-time` warning - a day that is
    short has to say why, or the reviewer hunts for time that was never collected.
  - **A history reader would otherwise undo the whole thing.** A git scan reads 26 hours back (30 days
    on the first run of a session), so the first scan after a resume would collect the very commits
    the pause was taken to keep out. `events_append` refuses any observation dated inside a pause,
    which is one rule in one place rather than four collectors each remembering it. Cursors still
    move for a refused line, as they do for an excluded one.
  - **Resuming has to forget what was last emitted.** A focus sample is only pushed when it differs
    from the previous one, so a resume in the window the pause started in would emit nothing until
    the next context switch, and the block would never restart.
  - macOS stops reading the machine outright - no `frontmost()`, no Accessibility IPC, no idle timer.
    Wayland cannot: the compositor pushes at us unsolicited, so there the pause refuses the samples at
    the sink. `WindowSource::push` enforces it on every platform, so a source that forgets to ask
    still collects nothing.
- **Own OAuth clients.** Per provider, registered by the user, PKCE + loopback redirect on a
  random localhost port. Client id/secret and tokens live in the keychain; refresh happens in
  Rust. The webview never sees a token. Onboarding needs a real guided flow per provider with
  the exact scopes and console steps, because this is the single biggest friction point in the
  whole product.
- **A visible data inventory.** ~~One settings screen listing every collector, whether it is
  on, what it stores, and how long.~~ **Built** - `src/app/sources/`, and it replaced the per-collector
  status cards rather than sitting beside them. Two things it settled:
  - **List the sources that are not built, too.** The question somebody deciding whether to install
    this asks is about the whole surface it will eventually watch, so Slack, Discord, Gmail and the
    editor extension are on the list as `planned`, each with what it _would_ store. Three
    states carry it: `collecting`, `configured` (the code is there, the credentials are not) and
    `planned`.
  - **Liveness cannot be a per-run or per-session tally.** Every collector here reads on a short
    interval and stores nothing on most runs - a caught-up git scan re-reads 131 events and appends
    none - so a run count reads zero while the source is perfectly healthy, and a page reload resets
    a session count. `events_by_source` answers it out of the database instead: how many events the
    source has, and the newest one's instant. A count that is large and an instant that stops moving
    are distinguishable; "0 stored" is not. Exclusions and dropped samples stay session-scoped,
    because nothing stores them by design.
- **The settings themselves.** **Built** - `libs/timetrack/src/lib/settings/` (the model, the tolerant
  read, `effectiveExclusionRules`, the credential readers) and `src/app/settings/` (the screen), over
  schema v5's single-row `app_setting` table and `TimetrackSettingsStore`. It carries the day target,
  the Jira instance, the deny list and the git scan roots. What building it settled:
  - **A credential is split the way it is stored.** The instance and the account email are in the
    document, because a screen has to show which Jira it will talk to; the token is a keychain entry.
    So `TimetrackSecretStore` gained `has$` - the field is write-only and starts empty however long a
    token has been configured, and the badge is answered without the value ever crossing back.
  - **A settings document has to survive its own past.** `parseTimetrackSettings` falls back per field
    and clamps the day target rather than throwing: a document an older version wrote, or one a
    hand-edit broke, has to leave the app usable, and the fields it does understand still apply.
  - **An uncompilable rule survives the read** for the same reason `applyExclusionRules` reports it -
    dropping it silently is what makes a user trust a rule that protects nothing.
  - **A collector must not run before the settings arrive.** Both the window and the agent-session
    collectors wait on `ready$` (the first read, failure included) before draining. Otherwise the first
    batch is filtered with the defaults alone and a title the user's own rule denies reaches the
    database because the document was still in flight - and that is not a failure a later delete fixes.
  - **Agent-session titles were bypassing exclusion entirely.** A session is named after the work, so a
    title pattern has to apply to it exactly as it does to a window. The cursors still move for a
    denied line: it was read, and re-reading it would only deny it again.
  - Still owed here: the hard pause, the OAuth client registration, and the marker scheme. The two
    ticket-creation config values - `subjectField` and parenting - now have fields to hold them
    (`TimetrackTicketSettings`, the New tickets section); what is missing is the answer, not the seam.

## Picked projects, and rows the machine never saw

Two failures showed up on the same day (2026-08-17), and the answer to both is that the app was asking
the user to type things it could have read.

**1. A project key typed from memory is a setting nobody can check.** `issueKeyPrefixes` was a text
field, and an empty one accepts anything shaped like a key. Working on this app with the Google Cloud
console open produced a worklog against a `GCP-…` issue that has never existed: `issueKeyInText` read
the console's own identifier out of a window title and the empty prefix list waved it through. What
that settled:

- **The prefixes are the projects, and the projects come from Jira.** `favoriteProjects` holds what a
  multi-select over `/project/search` chose, key and name together. `gitFlowConfigFor` reads the keys,
  so picking your projects _is_ configuring the branch grammar — one list, one place, and no key that
  can be a character wrong.
- **Free text fails closed.** `issueKeyInText` yields nothing while the list is empty, rather than
  trusting the pattern alone. It is the one rung that reads a string nobody wrote for this app, so it
  is the one rung that must not guess. A branch name is untouched: `parseBranch` states both keys
  itself, and a machine whose list is still empty has to keep working.
- **The same list is every picker's scope.** An instance has hundreds of projects and a person works in
  a handful; a picker offering all of them is a search box, not a list. One shared read of the open
  issues of those projects backs every picker in the window, each filtering it as the user types — a
  request per keystroke per row is what a search-per-picker would have cost.
- **A typed key is still accepted.** The list is the hundred most recently touched issues, so logging
  against something nobody has opened in months has to stay possible. A picker that refuses a key the
  user knows is a picker they work around.

**2. A day could only ever be edited, never written to.** Every operation the review offered reshaped
what the collectors saw — split, merge, move a boundary. A meeting held away from the desk, an hour on
somebody else's machine and a phone call leave no evidence at all, and the only way to put them on the
day was to stretch a row that meant something else. `addManualRow` writes one instead:

- **It carries no observed time, and it is `certain`.** Both halves are honest: nothing watched it, so
  `observedMs` is zero and the day's evidence-backed total stays a number that can be checked; a person
  stated it, which is the strongest claim the app has. The new `manual` evidence kind is how the row
  says so in its own chain.
- **It is a `PinnedRow` with an empty `replaces`.** The mechanism for "a row the engine did not
  produce" already existed; a row that replaces nothing is the one case it had ruled out.
- **The timeline is where it is drawn.** A range dragged over empty grid is the scheduler's own
  `draftRange`, a row dragged to another time is its `appointmentDrag`, and both preview themselves
  because the layout reads `effectiveAppointments`. What the app adds is what the grid cannot know:
  what a pointer position means in this day's geometry, and that a worklog snaps to the quarter hour.
  A move keeps the row's duration and a resize re-reads it — the clock says when, the duration says how
  much, and dragging a row an hour later changed only the first.
- **The stories the day rolls up to are all-day appointments, parents of the rows under them.** An
  all-day entry is laid out on the day axis rather than the hour axis, so a band cannot steal width
  from the rows it groups — which is exactly what a story band drawn as a timed appointment does.

**3. Prose in a settings screen is read once and then never again.** The screen had a paragraph over
every field, and the paragraphs were right: what a wrong value costs here is rarely visible from the
field. They are now behind a glyph next to the thing they explain (`ethlete-explain`), and the screen
is five tabs. The text was never the problem; printing all of it at once was.

**4. A donor block can be too big to be a favour.** `maxDonationBlockMs` (two hours) keeps a long
stretch in a donating repository unattributed instead of folding it into whatever ran beside it. The
goal of donation is that SDK work lands on the project it was done for; an afternoon in the SDK is its
own piece of work, and hiding it inside a client's row is the opposite of the same goal.

## Phasing

**Phase 1 - the spine.** ~~event model, sessionizing, the branch-grammar parser, correlation~~
**done** - `libs/timetrack` ships the four-layer model, the host ports and the whole deterministic
pipeline (`sessionize`, `attribute`, `matchMeetings`, `merge`, `round`/`check`, `describe`, `propose`,
and `correlateDay` over all of them), with no network, filesystem or Angular in it, the read-only
Jira provider on top, the whole Tempo integration - work-attribute discovery, foreign-time
subtraction, the sync diff and the write half that executes it - the read-only Google Calendar
provider, and the store's core half - persistence ports, exclusion rules, retention, ledger writer -
plus the Claude Code session-log parser with its cursor-driven collector, and the git reconcile pass
(478 tests). The host shell now exists too: `apps/timetrack` with the encrypted database, the
keychain key, all five ports wired over `invoke`, and the theming and Tailwind foundation the review
UI will sit on, plus the file reader behind `AgentSessionLogReader` and the timer that drives
`collectAgentSessions$` and persists what it returns. ~~Remaining: Google's OAuth dance~~ **- built**,
along with the calendar collector it was the last thing standing in front of, so every phase-1
collector now exists. ~~Remaining: the confirm step that executes a Tempo sync~~ **- built**, so the
app now reconstructs a day and writes it. ~~Remaining: the hard pause~~ **- built**, and so is the
end-of-day reminder that tells the user a day is still owed. Remaining: a first run against the real
instance - nothing here has written a production worklog yet. No LLM, no Slack/Discord/Gmail. Ends the phase able to reconstruct and sync a real day.

**The app runs.** `yarn timetrack` builds and starts, the keychain hands back the key it generated on
first run, SQLCipher opens the database with it (the file's header is random bytes, and a plain
`sqlite3` refuses it), and the commands answer over IPC. The three the shell calls on load came back
on the first try, as did the four the collector uses. Nothing had to change to get there, which also
retires the errors this plan expected around `keyring` v4's API, `State<'_, T>` in an `async`
command, and `AsyncWriteExt` (tokio's `process` feature pulls in `io-util` on its own).

Two things the run turned up, neither in the app: `libayatana-appindicator` warns that it is
deprecated in favour of `-glib`, which is worth following before the tray is built; and once
`src-tauri/target` exists, `nx lint timetrack-app` fails on generated `__global-api-script.js`
files inside it, so the app's `eslint.config.mjs` ignores that directory.

Both the check and `cargo test` run through a scratch crate whose `[lib] path` points at the real
`src/lib.rs` and which depends on `rusqlite`'s plain `bundled` feature, so neither waits on the
vendored OpenSSL build - the trick to reuse whenever perl or OpenSSL is in the way. The path has to
be the crate root rather than a `#[path]`-included submodule, or every `crate::…` in these files
resolves against the wrong root. It is still the fastest way to run a Rust test here, and it cannot
collide with a `tauri:dev` that is already up.

**The dev machine is now macOS, not the Wayland box this plan was written on.** The design was
unaffected - the window source was always meant to be pluggable - and the macOS source is now
built, so this machine collects focus and presence again. The Wayland notes stay: they are
verified, and the app is cross-platform. Everything else in the phase is portable.

**The Mac had no Rust toolchain.** It is `rustup` from Homebrew (`brew install rustup`, then
`rustup toolchain install stable`), and `rustup-init` is not on the path - the formula installs
`rustup` alone. `sh.rustup.rs` does not resolve on this network, so the official script is not the
way in here.

**Phase 2 - closing the code-work gaps.** ~~GitLab CE events and MR review time~~ **- built**, so a
review that left no local trace now names the Task it was for. ~~The reasoning provider~~ **- built**,
and ~~the retroactive ticket-creation flow~~ **- built**, so work nothing could name can now become a
ticket rather than a row the reviewer rejects every day. ~~The prospective
ticket → branch → draft MR flow~~ **- built**, and ~~MR → ticket repair~~ **- built**. ~~The VS Code
extension and the generic ingest endpoint~~ **- built**, so an editor now names the checkout and
branch that a window title reading `Visual Studio Code` never could. **Phase 2 is complete.**

**Phase 3 - the noisy tail.** Slack huddle polling, Discord (bot mechanism, guild-scoped,
`weak`), Gmail notification parsing, Codex session logs, and a Chrome extension if window
titles have proven insufficient by then.

**Deliberately not in the plan.** Any manager or aggregate view over other people's time; a
hosted backend or cross-device sync; a Jira Data Center provider (keep the seam, do not
build it); non-Tempo worklog targets.

**Sequencing note.** ~~Steps 1-2 of `plans/git-flow-system.md`'s rollout - the grammar config,
the parser and `check`/`explain` - come before phase 1 here~~ **- satisfied.** The parser ships in
`@ethlete/agent-rules/git-flow`, and `planStart` is the seam the prospective ticket → branch flow
plugs into. Phase 1 is unblocked; the rest of that plan's rollout (adoption, gating) runs
alongside and only affects how much of a day arrives pre-labelled.

## Ideas not yet scheduled

Raised 2026-08-16, in no order and none of them designed yet.

- ~~**Work versus private use of the same application.**~~ **- built**, see below.
- **A Windows collector.** The window source was always meant to be pluggable and macOS proved it;
  Windows is the third source. Focus and idle both have plain Win32 answers
  (`GetForegroundWindow`, `GetLastInputInfo`).
- ~~**A floating mini widget.**~~ **- built**, see below.
- **Auto-resume, and auto-pause on standby.** Resuming when work is noticed again - VS Code activity,
  a meeting starting - and pausing when the machine suspends. **This is in tension with the hard
  pause, which is a promise that nothing collects until the user says so.** If both ship, they have
  to be two different things: an _automatic_ pause may resume itself, a _hard_ pause may not, and the
  UI must never present them as one control.

## Open questions

1. **The Jira hierarchy** (Story → Task) - **the reader exists**; `describeJiraHierarchy$` reports
   the instance's levels and whether the parent field can express the relation at all. **The field
   now exists too** (`ticket.parenting`), and both modes it can hold are implemented. What is left is
   running the reader against the real instance and writing the answer down. It no longer blocks the
   retroactive flow - that flow ships on the `parent-field` default - only its correctness.
2. **The story-subject meta field** - which Jira field holds `user-management` in
   `feat/FIP-2177-user-management`. Needs a real instance to name. **Both sides now read and write
   it**: `fetchJiraIssues$` and `fetchJiraParentCandidates$` take `subjectField`, `createJiraIssue$`
   writes it, and `ticket.subjectField` holds the id. Empty writes no subject, which is what an
   unanswered instance does today.
3. ~~**Whether `git-flow-draft.md` lands as written**, especially nested sub-feature branches~~
   **Resolved for the load-bearing part.** Nesting stays, under a `sub/` prefix, and the parent's
   full path stays inside the child's name - so Story-level roll-up is safe. What is still open is
   adoption, not shape: the 2026-08-11 baseline in `plans/git-flow-system.md` has 3 of 125
   fut-frontend branches conforming, so the no-key path carries most of the day for now.
4. ~~**Tempo attribute writability** - whether a custom attribute can hold the app's worklog id~~
   **Answered against the real instance (2026-08-12): it cannot, because there are none.**
   `GET /4/work-attributes` on `braune-digital` returns `count: 0` - the instance defines no work
   attributes at all, so `findMarkerAttribute()` has nothing to find and the `attribute` scheme is
   unavailable without an admin creating one. That leaves `description-suffix` (a visible
   `[et:<proposalId>]` tag on every worklog the app writes) or `none` (the local ledger is the only
   ownership record, and losing it makes every worklog the app wrote foreign for good). Both are
   implemented; the preview currently runs `none`, and the choice is a config value, not code.
   Also measured: the instance is EU-hosted, so `api.tempo.io` answers with `api.eu.tempo.io` URLs
   in `self` and `metadata.next` - which is why `tempoPaged$` following an **absolute** next URL is
   load-bearing, not a nicety.
5. **Working-hours and billability policy** - is time outside configured hours proposed at
   all, and does the day target vary by person or contract.
6. ~~**`ai-title` stability** in Claude Code's session logs - it is an internal field and a
   good description source, so it needs a fallback (first user message, truncated) when
   absent.~~ **Answered, and the fallback is built.** Measured over the 436 logs on this machine:
   382 carry an `ai-title` (88%), and the first `last-prompt` record closes the gap to 418 (96%).
   The remaining 18 are sessions with no prompt at all. The fallback is opt-in
   (`promptFallback: { maxLength }`) because a prompt is message content, so the host decides
   whether a raw prompt may become a worklog description.
