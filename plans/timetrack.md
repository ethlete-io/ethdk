# `@ethlete/timetrack` - a Jira/Tempo time tracking helper

Scope worked out with Tom on 2026-08-11. A local-first cross-platform desktop app that
watches what you actually did, reconstructs a day of worklogs from that evidence, lets you
review and edit it, and syncs the result to Tempo - plus the ticket plumbing around it
(create a ticket under the right parent, create the branch, open the draft MR).

Everything below is grounded in what was verified on this machine (`niri`'s IPC, the local
Claude Code session logs, `fut-frontend`'s real branch names) or is explicitly flagged as
unverified. Where an external API's shape matters to the design, the relevant detail is
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
| Platforms       | Wayland-first with a pluggable window source; degrade gracefully where there is none                     |
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
2. **Commit subjects never carry the key.** They are strict conventional commits
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
  src-tauri/                        Rust: collectors, storage, keychain, tray, process spawn
```

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

## Data model

Four layers, each derived from the one before, each kept so the chain is auditable:

1. **`CollectedEvent`** - a raw observation, append-only, from one collector. Timestamp,
   source, kind, payload. Never edited, expires per the retention policy.
2. **`ActivityBlock`** - contiguous same-context time after sessionizing (idle gaps split,
   sub-minute flapping merged). Carries the union of evidence that produced it.
3. **`WorklogProposal`** - a block or set of merged blocks attributed to an issue, with a
   duration, a description, a confidence, an evidence chain, and a state
   (`suggested` | `accepted` | `rejected` | `edited` | `synced`).
4. **`SyncedWorklog`** - a proposal that exists in Tempo, holding the Tempo worklog id and a
   content hash for change detection.

`Evidence` is the load-bearing type. Every proposal must be explainable in the UI as a list
of concrete observations ("branch `feat/FIP-2177-user-management/FIP-2178-…` checked out
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
- **macOS/Windows**, if they arrive: `NSWorkspace.frontmostApplication` plus the AX API for
  the title (needs the user to grant Accessibility permission - a real onboarding step), and
  `GetForegroundWindow` + `GetWindowText` (trivial by comparison).

Titles are the most sensitive thing collected. They are matched against the exclusion rules
_before_ being written, and the sampled title of an excluded app is never persisted at all.

### Local git repos (Rust, phase 1)

Watch configured repo roots for `HEAD` changes (an inotify watch on `.git/HEAD` and
`.git/refs`, plus a periodic reconcile for missed events). Emit branch checkouts with
timestamps, and read commits with author time, subject and changed paths. Under the grammar
this yields the Story/Task keys; the commit subjects and changed paths yield the worklog
description. Also worth capturing: rebases and stashes (they mark context switches), and
which repo is which project.

### Coding-agent session logs (Rust or TS, phase 1)

Verified: Claude Code writes `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`, where the
directory name is the working directory (`-home-tom-dev-fut-frontend`), and `user` /
`assistant` / `system` / `attachment` records each carry `timestamp`, `cwd`, **`gitBranch`**
and `sessionId`. There are also `ai-title` records (a generated session title) and
`last-prompt` records.

This is the single best-value collector per line of code in the whole plan: it gives precise
start/end timestamps, the project, the branch (hence the Story and Task keys), and a
human-readable statement of what the session was about - all from tailing a JSONL file. No
API, no permission, no OAuth. Note the log also contains prompt and response text; parse
only the metadata fields and the `ai-title`, and never persist message bodies.

Codex's equivalent (`~/.codex/sessions/**`) is unverified - `codex` is not installed on this
machine. Model both behind one `AgentSessionSource` interface and implement Claude Code
first.

### Editor heartbeats (phase 2)

A small VS Code extension posting `{file, language, project, repoRoot, branch, isTyping}`
to the daemon's local ingest endpoint every ~30s. More precise than window titles (real
file paths, typing vs reading) and it is what makes "you spent 40 minutes in
`libs/components/src/lib/table`" possible. Design the ingest endpoint generically now - a
localhost HTTP POST with a shared secret from the keychain, accepting a `source` discriminator

- so the extension, a future Chrome extension and any other reporter all use one path.

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

### GitLab CE, self-hosted (phase 2)

PAT with `read_api`. The high-value endpoint is `/api/v4/events` scoped to the user with
`after`/`before` - it returns `action_name` and `created_at` for pushes, comments,
approvals and merges, which is a genuine retroactive record of review work that leaves no
local trace. Complement with `/api/v4/merge_requests?scope=all&reviewer_id=…` for MRs
awaiting you, and MR notes for the actual review comments.

Review time matters more than usual here: the draft mandates that every sub-feature MR is
reviewed by another developer, so a meaningful share of the day is spent in other people's
MRs. That time currently has no ticket - it belongs on the reviewed Task, and the MR's
source branch name gives that key straight from the grammar.

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

## Correlation

A pipeline of pure functions over an event window, each independently testable:

1. **Sessionize.** Merge sub-minute flapping, split on idle beyond the threshold, split on
   lock/suspend, clamp to configured working hours if enabled. Produces `ActivityBlock`s.
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
   key > key inherited through the base > MR/issue-view activity > Tempo history for a
   recurring pattern (same weekday, same ticket) > window-title key. Calendar events with a
   matched Meet title and an accepted response become meeting proposals directly.
5. **Merge and split.** Combine adjacent blocks on the same issue; keep a genuine context
   switch separate even if short. Cap the number of worklogs per day so review stays
   tractable - a day of 40 two-minute rows is not reviewable. Merging is where the
   fragmented reality of a real day becomes a submittable set.
6. **Round and check.** 15-minute rounding by default, applying the residue to the largest
   entry within its own block so total time is preserved rather than invented. Compare the
   day to the configured target and warn on over/under. Never fill to target silently.
7. **Describe.** Build each worklog's text from commit subjects, the agent session's
   `ai-title`, the calendar event title, the MR title - in that priority order. This is
   where the tool earns daily goodwill: nobody wants to write "worked on user management"
   forty times a month.
8. **Explain.** Attach the evidence chain and compute confidence.

Only blocks that reach step 5 with no candidate issue at all go to the reasoning provider.

## The reasoning provider (agent CLI, not an API key)

Locked decision: use the user's existing Claude or Codex **subscription** by invoking the
CLI they already have installed, rather than requiring an Anthropic API key.

Verified locally: `claude` is at `~/.local/bin/claude` and supports `-p/--print`,
`--output-format json`, `--model`, `--append-system-prompt`, `--allowed-tools`,
`--permission-mode` and `--bare` (which skips hooks, LSP, plugin sync, auto-memory,
keychain reads and `CLAUDE.md` auto-discovery - exactly right for a one-shot, context-free
call). `codex` is not installed here, so treat it as a second implementation of the same
interface, unverified.

Contract:

- **One call per day-review**, not per gap. Spawning the CLI costs seconds; batch every
  ambiguous block of the day into a single request. Cache the result against a hash of the
  input so re-opening a day does not re-spawn anything.
- **No tools, no filesystem.** Run with tools disabled, in an empty working directory, with
  `--bare`. The prompt is entirely self-contained. The provider must not be able to wander
  the disk.
- **Redacted payload.** Only compacted blocks go out: durations, candidate issue keys and
  summaries, branch names, repo names, calendar event titles, agent-session titles. Never
  raw window titles, never file paths, never message bodies. The exact payload is
  inspectable in the UI before it is sent, and the feature is off until enabled.
- **Structured output.** Request JSON in the prompt, parse `.result` from
  `--output-format json`, validate with a schema, retry once on a parse failure, then fall
  back to leaving the block unattributed. A model that cannot answer must degrade to an
  empty gap, never to a guess.
- Anything the provider proposes is at most `likely`, and is marked as model-inferred in the
  evidence chain so it is visibly distinguishable from a deterministic match.

## Ticket creation

### Retroactive: work → ticket

A block with no candidate issue. The app drafts a summary and description from its evidence
(commit subjects, changed paths, repo, agent-session title), searches open issues for
plausible parents - text similarity against summaries, restricted to the project inferred
from the repo, ordered by recent activity - and presents a create form with the parent
pre-selected and editable. On confirm: create the issue in Jira (correct parenting per the
discovered hierarchy), set the story-subject meta field, and attribute the block to the new
key. The Jira field holding that subject is instance-specific and must be configurable; the
draft names the concept but not the field.

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

Also worth having, cheaply: **MR → ticket repair** - an MR or branch with no key gets an
issue created and the branch/MR retitled to conform. Given how many non-conforming branches
exist in `fut-frontend` today, this is the flow that migrates reality toward the grammar. The
rename half of it is `git-flow repair`; timetrack adds only the "create the missing issue"
step in front of it.

## Review UI

Tray presence plus a day view, built with `@ethlete/components`.

The tray shows current activity and today's total, and carries the start/stop timer for the
explicit half of the hybrid model. Two Wayland realities to design around rather than
discover later:

- The tray is a StatusNotifierItem and needs a host. On `niri` that means a bar that
  implements SNI (waybar and friends). **The tray must therefore not be the only way in** -
  ship a `timetrack open` CLI that focuses the running instance via
  `tauri-plugin-single-instance`, so the user can bind it in their compositor config.
- `tauri-plugin-global-shortcut` does not work on Wayland; there are no global grabs. Do not
  promise a global hotkey - the compositor binding plus the CLI is the answer.

The day view is a timeline of blocks beside an editable worklog list. Each row shows issue,
duration, description, confidence and an expandable evidence chain; weak rows are visually
distinct and unchecked. Editing is local and immediate - change the issue, split a row, merge
two rows, retype a description, drag a boundary. The footer shows proposed total vs target
vs already-in-Tempo, and the sync button opens the diff preview. An end-of-day nudge fires if
a day is unreviewed, and a week view lists unreviewed days for catching up.

Local edits always win over re-correlation: re-running the engine on a day must never
silently discard a row you touched. Mark edited proposals and merge around them.

## Storage, privacy, secrets

- **Encrypted SQLite.** `rusqlite` with bundled SQLCipher, key generated at first run and
  stored in the OS keychain (`keyring` crate; `tauri-plugin-stronghold` as the alternative).
  Note that `tauri-plugin-sql` uses sqlx without SQLCipher, so it is the wrong choice here.
- **Retention.** Raw `CollectedEvent`s expire on a configurable window (default ~30 days)
  after which they are compacted to attributed blocks and deleted. Synced worklogs and their
  evidence summaries persist.
- **Exclusion rules.** Deny by app id or window-title regex, evaluated before persistence.
  Ship sensible defaults (password managers, banking, private-browsing windows) and make the
  list visible and editable in settings.
- **Hard pause.** One click stops all collection, visibly, until resumed. Not a filter - the
  collectors stop.
- **Own OAuth clients.** Per provider, registered by the user, PKCE + loopback redirect on a
  random localhost port. Client id/secret and tokens live in the keychain; refresh happens in
  Rust. The webview never sees a token. Onboarding needs a real guided flow per provider with
  the exact scopes and console steps, because this is the single biggest friction point in the
  whole product.
- **A visible data inventory.** One settings screen listing every collector, whether it is
  on, what it stores, and how long. For a tool that watches your workday, this is the
  feature that makes it installable by someone who is not its author.

## Phasing

**Phase 1 - the spine.** Encrypted store, event model, sessionizing, the branch-grammar
parser, the window/idle collector (wlr protocol + niri enrichment + X11 fallback), the git
watcher, Claude Code session logs, Jira + Tempo providers with attribute discovery and
own-worklog upsert, Google Calendar, the day-review UI, tray, sync with diff preview. No
LLM, no GitLab, no Slack/Discord/Gmail. Ends the phase able to reconstruct and sync a real
day.

**Phase 2 - closing the code-work gaps.** GitLab CE events and MR review time, the VS Code
extension and the generic ingest endpoint, the reasoning provider, both ticket-creation
flows, MR → ticket repair, week view.

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

## Open questions

1. **The Jira hierarchy** (Story → Task) - resolve by reading the instance's issue types and
   hierarchy before building the create flows. Blocks phase 2, not phase 1.
2. **The story-subject meta field** - which Jira field holds `user-management` in
   `feat/FIP-2177-user-management`. Needs a real instance to name.
3. ~~**Whether `git-flow-draft.md` lands as written**, especially nested sub-feature branches~~
   **Resolved for the load-bearing part.** Nesting stays, under a `sub/` prefix, and the parent's
   full path stays inside the child's name - so Story-level roll-up is safe. What is still open is
   adoption, not shape: the 2026-08-11 baseline in `plans/git-flow-system.md` has 3 of 125
   fut-frontend branches conforming, so the no-key path carries most of the day for now.
4. **Tempo attribute writability** - whether a custom attribute can hold the app's worklog id,
   or whether the marker has to live in the description.
5. **Working-hours and billability policy** - is time outside configured hours proposed at
   all, and does the day target vary by person or contract.
6. **`ai-title` stability** in Claude Code's session logs - it is an internal field and a
   good description source, so it needs a fallback (first user message, truncated) when
   absent.
