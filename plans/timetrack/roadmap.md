# The roadmap

The live Timetrack work, grouped by milestone. It lists only what is not built yet. Plan a slice
end to end with the `ethlete-grilling` skill before building it. The terms are in
`libs/timetrack/CONTEXT.md`, and the hard-to-reverse decisions are in `libs/timetrack/docs/adr/`.

A slice number is a name, not a position. ADRs cite slice numbers, so never renumber them. New work
gets the next free number. Every new flow needs the three e2e tests in
[`apps/timetrack/TESTING.md`](../../apps/timetrack/TESTING.md) ("Every new flow").

| #   | Name                            | Slices | Ends when                                                          |
| --- | ------------------------------- | ------ | ------------------------------------------------------------------ |
| M5  | No day is lost                  | 7      | A reboot, a crash and two hours off all reconcile on the screen.   |
| M6  | Book it                         | 3      | One real week reaches Tempo, and the second sync writes nothing.   |
| M7  | One day, every machine          | 8      | A day worked on two machines reads the same on both, once.         |
| M8  | What a day cost                 | 5, 9   | A real day shows a cost Tom recognises, and names what it missed.  |
| M9  | The week, and the price of work | 6, 10  | Time and cost per issue and per project, over a week.              |
| M10 | A second person installs it     | 11     | A colleague books a day from a build, with no help from this repo. |
| M11 | The noisy tail                  | 12     | The browser reporter, if needed, and a Figma plugin.               |

M1 to M4 are built. Their leftovers come first below.

## M1 leftover: naming a browser tab

Take the fourth reading of unnamed focus (five workdays, due after 2026-09-09; not recorded yet).
Then decide between these, together:

- A title rule that says "no work". Tom named YouTube, Jellyfin, Spotify and Home Assistant tab
  titles. `DEFAULT_NO_WORK_CONTEXT_APPS` matches `app_id` only, so `verdictFor` reads them as a gap.
  Decide whether they belong to a no-work-context rule (keeps the minute, marks it) or an exclusion
  rule (drops the event). A no-work title rule may need its own kind: `title-pattern` in
  `store/exclusion.ts` only denies.
- A title rule that names an issue. A Chrome block over two minutes is dropped by
  `dropNoWorkContext` before the ladder runs (`rows/build-rows.ts`), so a browser tab that is the
  whole record of the work (e.g. a Claude chat on ET-772) gets no row and no question. `holdsWorkApps`
  would make any rule on it app-wide.
- A browser reporter (M11). It would read `location.host`, GitHub repos and Jira keys directly. It
  needs an `Origin` exception in `src-tauri/src/ingest.rs` and a native messaging host, because an
  extension cannot read the discovery file.
- Nothing: a timer or a hand-written row covers it.

Minor: a private project's browser host still shows in the unnamed-focus panel, and no private link
covers it.

## M3 leftover: an absence entry is not a meeting

A hand-written calendar entry such as "Tom Tom unterwegs" is drawn as a meeting, and the edit
surface offers "Use its time". Google only sets `eventType: 'outOfOffice'` for its own Out of office
type, which `google-calendar/events.ts:25` already drops. Decide what tells an absence from a
meeting: a single attendee, no call observed over it, or a wording the user teaches once. ADR 0010
says an accepted occurrence with no call observed proposes nothing, so the "Use its time" offer
contradicts it. Settle that too.

## M4 leftovers: creating in Jira

- **Required fields the app cannot fill.** `createmeta` parses `requiredFieldIds`, and nothing reads
  it. The design: learn the dominant value with one JQL per project and issue type through
  `searchJiraIssues$`; fill it when it is `likely` or better; otherwise open the Jira create screen
  with summary and description filled in; after a hand-off, read the issue back and store the chosen
  value per project, issue type and field. Confirm with Tom that this is still wanted.
- **The report for the project manager.** "Copy the report" was never built. Decide whether it stays
  as copied text once the project manager says what they want.

## One session, one piece

Slices 4 and 5 are open. See [`one-session-one-piece.md`](./one-session-one-piece.md).

## M5: No day is lost

Slice 7. Nothing is built: no autostart plugin in `Cargo.toml`, no crash restart, no tray-only start.

- Autostart on login, and a start into the tray with no window.
- A restart after a crash, and a day that spans a reboot.
- A stretch the app did not watch, stated on the day screen as such.
- The rebuilt-time path of ADR 0006, proven end to end.
- A tag-triggered desktop release workflow (none in `.github/workflows`).

Exit test: three interruptions on one real day. Reboot, kill the process, and quit for two hours.
The day screen reconciles all three and names each stretch it did not watch.

To decide first:

- Is autostart on by default, or offered on first run?
- Does the tray say the app is collecting, or only that it runs?
- What does a day hold for the time before the first login of the morning?

The updater belongs to M10.

## M6: Book it

Slice 3. The sync write and its idempotence are built (`sync-write.spec.ts`).

- **The ownership marker.** Pick `none` or `description-suffix`. It is hardwired to `none` at
  `app/sync/sync.ts:151`, and the plan and the writes must change together. A worklog with no marker
  is foreign for good once the local ledger is lost. Pick before the first production write.
- **The working-hours policy.** Is work at 23:00 proposed at all? Does the day target vary per
  person or contract? ADR 0015 and ADR 0020 cover part of it.
- **Undo.** A wrong row that reached Tempo needs a way back out. The ledger is the only record of
  what the app wrote.
- **The first production write** gets its own gate: one day, one issue, one hour, checked by hand in
  the Tempo UI before a week is synced.

Exit test: one real week reaches Tempo through the app. Tom types no worklog by hand for code work.
Every day syncs twice, and the second sync writes nothing.

## M7: One day, every machine

Slice 8. Nothing is built. Tom works on a second machine during meetings, and this machine reports
those hours as unattended. Until M7 ships, that row is typed by hand.

Scope: the whole day merges (events, streams, spend), for any number of the user's own machines. A
colleague's machine never pairs. The privacy ruling is ADR 0013. Record the merge and the
event-identity change in an ADR before code.

- Discovery on the local network and pairing by hand. No port anything can simply join.
- A per-pair secret in each keychain, and an encrypted transport.
- The merge: presence unions with overlaps counted once, engaged time sums per stream, spend stays
  with the machine that spent it.
- Attendance travels, not only presence (ADR 0018). A minute is attended if any machine saw
  attendance in it.
- Exactly one machine books a day.
- A machine that is off is named, and the day reads as incomplete, not short.
- Schema: `collected_event.id` is a local `AUTOINCREMENT`. Add an origin and a stable id per event
  in a new migration past version 13. Never edit a migration that has run.

Exit test: one real workday on both machines, with a meeting on the second. Both show the same
presence, engaged time, spend and concurrency, and no hour counts twice. One machine books the day,
and the other refuses to book it again. Switch the second off for an hour: both screens say the day
is incomplete and name the missing machine.

To decide first:

1. Which machine owns a day: a fixed one, or the one the user books from.
2. Clock skew: the tolerance, and what happens past it.
3. The stream key: two machines with a checkout of the same name are one stream or two.
4. Continuous or on-demand merge, and what happens when a merged day changes later.
5. What a paired machine needs: only collectors, or the whole Jira, Tempo and Google stack.
6. Retention and redaction over what arrives, including the private-project link.

## M8: What a day cost

Slices 5 and 9. `unattributedSpend` is built and shown in `day-notes`.

- The price table (slice 5). It turns tokens into money per model and day. It ships empty, and a
  price is dated, so re-reading an old day never reprices it. No `ModelPrice` exists yet.
- A cost on the day, with the share of spend no stream took stated, not folded in.
- A second, per-plan price mode, if subscription days are used for pricing.
- Whether a model-call press refreshes the day. `probe` in `day-review.ts` tracks collector
  `lastRun()`, so the own-spend line appears only on the next collector pass.

Exit test: a real day shows a cost Tom recognises, and states the share of spend no stream took.

## M9: The week, and the price of work

Slices 6 and 10. The week already reads `readDay$`.

- Spend and cost per issue and per project over a week.
- Cost per issue against its estimate, and a total per project per month.

Exit test: a week that shows both numbers per issue and per project.

Decide before M9 is planned: does the cost goal mean one person's cost of an issue, or the
company-wide cost? The company-wide number would need an aggregate view over other people's time,
which is ruled out. That is a product decision, not a slice decision.

## M10: A second person installs it

Slice 11. It may split when planned.

- A packaged, signed build per operating system, from CI.
- An updater, and what an update does to a day being collected.
- First run: the keychain, the database, and the autostart choice from M5.
- Per-user OAuth and credential setup for Jira, Tempo and Google, as a guided screen.
- The window lock verified on macOS in a signed build, and on Windows at all.
- The collector gaps below.

Exit test: a colleague installs a build, connects their own Jira, Tempo and Calendar, and books a day.
They use no file from this checkout.

To decide: which operating systems the first build covers, and who pays for an Apple Developer
identity. The install must make pairing with another person's machine impossible.

### Collector gaps

- **Windows window source:** `GetForegroundWindow` + `GetWindowText`, and `GetLastInputInfo` for
  idle. No `window_windows.rs` exists.
- **Windows call source:** WASAPI `IAudioSessionManager2`, then `IAudioSessionControl2::GetProcessId`,
  named by pid. The portable half (`calls.rs`, `stream/calls.ts`) is done. It cannot be verified
  without a Windows machine or target.
- **Linux window fallbacks,** only if Linux users matter: X11 via `_NET_ACTIVE_WINDOW` +
  `_NET_WM_NAME`, GNOME/Mutter (needs a shell extension; document it as a gap), and logind `IdleHint`
  plus `Lock`/`Unlock`/`PrepareForSleep` for idle.
- **macOS title path:** verify window titles on a Mac with Accessibility granted. It has only run
  ungranted.

## M11: The noisy tail

Slice 12. Every entry is a source over the ingest seam.

- **The browser reporter,** only if the M1 decision says it is needed.
- **A Figma plugin,** so designers get detailed tracking. Only an inventory entry exists
  (`sources/inventory.ts:205`). It differs from the other reporters:
  - It cannot read the `0600` discovery file. A pairing code shown in the app and kept in
    `figma.clientStorage` is the likely shape. Measure first whether a plugin may reach the loopback
    port at all.
  - A Figma file key names the time, not a checkout. It needs a link table beside `projectLinks`, and
    the private-project rule must hold on it.
  - It must add what the window title cannot: the file, the page, and whether the person edited.
  - Decide whether it ships before M10, and whether a file-key link is a rung or its own source.
- **Optional:** a `PostToolUse` hook on the Agent tool in `@ethlete/agent-rules`. It writes one JSONL
  line per spawn (`agentId`, `description`, `subagent_type`, `model`, parent `sessionId`, instant), so
  subagent spend can be named. The collector joins on `agentId`.

## Security

- **SEC-04 remainder.** Native data commands have no lock check, e.g. `events_between` at
  `src-tauri/src/store.rs:80`. Agent clients have no per-client or per-operation scopes.
- **SEC-08.** Build compaction first: a caller for `set_compacted_through` and a block store. Then
  schedule `planRetention` / `deleteEventsBefore$` (ADR 0002). `retention.ts` is unused today.
- **Capability gating has no test.** The e2e suite fakes `HOST_PORTS` and never crosses Tauri IPC.
  Run `yarn timetrack` once, open the widget, toggle the pause, press "Open Timetrack", and check the
  webview console for a refused command.
- **Packaged-build verification.** With a locked release build, try raw evidence reads, review edits,
  Jira creation, secret access and lock-setting changes through their real entry points. Check the
  keychain and file permissions. None of this is recorded.

## Design (Kerbe)

The calls live in `.ethlete/design/calls/timetrack/kerbe/`, served by `yarn design` on :4402.

- Call 11 (`kerbe/11-buttons`) has no verdict. It blocks call 10 (`kerbe/10-chrome`), which is left
  with options B and C, differing only in whether the day total stays.
- Not drawn yet: resize handles, the drag ghost, how the lane reflows during a move, a band being
  added, and a break the user adds, edits or removes.
- Not drawn yet: the active band that is still collecting, and the current-time marker.
- Data question: does work landing inside a derived break shorten the break?

## Exit tests only Tom can judge

None of these is recorded as done:

- M1: three replayed days (2026-08-12, 2026-08-17, 2026-08-18) read as true with no edit.
- M2: Tom reads and cuts a real day on one screen, and writes down his judgment.
- M3: Tom writes the issues down before opening the screen, then judges every band in writing.
- M4: the live case end to end (a stand-in on day 1, three days across two checkouts, the epic and
  both tasks filed from the card, no row typed by hand), plus one real week where every band has a
  key or a stand-in.

## Open questions

- Is Kerbe still headed into the app? Then its palette becomes an app theme and its fonts are
  self-hosted, not loaded from Google.
- Is `conferenceUrl` stored whole, or redacted?
- Should an editor heartbeat extend presence past `maxUnobservedMs`? It needs a day where the two
  answers differ, or park it.
- Repair the duplicate worktree rows stored before the worktree fix, or leave them?
- Is the masking name list seeded from the Jira project names yet?
- Is the concurrency ceiling warning (off by default) still wanted?
- Does outbound model payload privacy need a separate review beyond ADR 0013?
- Does ADR 0007 still owe a rebuild of the sync and start routes?
- The sources banner heading "Degraded" (`sources-view.component.ts:302`) is wrong for a source the
  platform never had. Pick a better word.
- Optional: Playwright screenshot comparisons for the day timeline.

## Settled - do not re-open

- No hosted backend, cloud or relay. No view over other people's time. No Jira Data Center, no
  worklog target but Tempo. Only one person's own paired machines may sync (ADR 0013).
- A model runs only on an explicit press, with the prompt shown first and names pseudonymised
  (ADR 0013, 0023). With auto mode on, it runs without a press on the current day and its match is
  not capped at `weak` (ADR 0035). Its answer never becomes a rule without a click and never writes
  the naming store. The Tempo sync is always a human press, and every agent endpoint write waits in
  the approval queue.
- No vendor call APIs (Slack huddle state, a Discord bot). The microphone holder is the signal.
- No Gmail source. The forge sources shell out to `glab` and `gh` and hold no token. A forge event is
  evidence, never time. Commit subjects never carry the issue key.
- Concurrent streams each book their full time, and a day may exceed its wall clock. No gate, no
  scaling. Sessions of one checkout, and a checkout with its worktrees, book once to the watched band
  (ADR 0034). `scaleToPresence` only if an invoice needs it.
- The price table ships empty. No price is hardcoded.
- No git flow is assumed. Never push subtasks or a branch per issue (ADR 0001, 0009).
- One app, one store, one day screen on `streamDay` (ADR 0004, 0011, 0014).
- A parent issue is pre-selected only when the ranking clearly leads. Once the app files an epic,
  Jira owns the hierarchy (ADR 0022). No invitation attendees for naming.
- Only evidence names a checkout: no guessed session sticky, no `app_id`-to-process match, no
  `path-prefix` exclusion, no widened `title-pattern`. The private project link is the privacy
  control. Never change `repoStickinessMs` in the same change as a mechanism.
- A break is corrected by `present`/`away` statements over a stretch, never by break id. A statement
  outranks every derived rule.
- A band that is not work takes nothing from a background band (ADR 0024).
- The timeline axis is a fixed 24 hours and is never cropped or rescaled.
- Auto-pause and auto-resume on standby stay deferred, and never share a control with the hard pause.
- No global hotkey on Wayland: `timetrack open` plus a compositor binding. The window lock uses the OS
  account credential, not TOTP, a passkey or a passphrase.
- No retention pass without compaction (ADR 0002).
- A rejected Google refresh token is not deleted automatically, and a refused revocation keeps it.
  "Remove on this machine only" is a separate action.
- The agent proof is answered before the token and lock checks. An unlinked checkout's cursor keeps
  its `cwd`; a private one loses it. `cargo-audit` is pinned from crates.io, its CI target is not
  cached, `unmaintained` is not denied, and glib RUSTSEC-2024-0429 is accepted.
- Heartbeats are reported per reporter, not per editor. Other agent CLIs (Cursor, Copilot, Gemini)
  are out of scope. No `tauri-driver` run for now. No client titles or keys in `libs/timetrack`
  fixtures.
- Band design: the metal says what a band asks of the reader, not how sure the matcher was. No
  ornament on anything that repeats about 20 times on a screen. Ornament marks a threshold, never a
  workspace.
