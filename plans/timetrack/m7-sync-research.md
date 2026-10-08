# M7 sync: research and recommendations (2026-10-08)

Tom decided all six on 2026-10-08, each as recommended in the table below, plus mDNS discovery with
6-digit code pairing. ADR 0039 records event identity and the merge. It replaces the "Event
identity" bullet below: a peer's events go into their own table, every key keeps its spelling, and
copies of one fact fold when a day is read. Slices 1 and 2 are done. Slice 3 is in progress (steps under slice 3 below).

## What made 2026-10-08 look wrong on this PC

- The PC was off from 10-07 01:04 to 10-08 19:26. The whole workday ran on the MacBook.
- The MacBook booked FIFAGG-12657 13:15-15:00 and FIFAGG-12704 15:00-18:00. This PC shows them as
  logged elsewhere.
- A 14:45-17:30 "Nobody was here" band on ethlete-sdk (ET-772, held back) is built from 61 laptop
  commits that this PC only received with the 19:27 fast-forward. A commit is dated by when it was
  written, so pulled commits read as work on this PC (open point in ADR 0018).
- That band carries Claude session `14253710`, which started on this PC at 19:28, after the band.
- The 19:15 increment with real attendance (pull, prompts, focus) is missing from the rows. A
  19:30-19:45 "Nobody was here" band with no evidence sits in its place.
- Google refused the stored token, so no meeting could be checked. Reconnect in Settings.
- Coverage already holds the laptop's worklogs, so the ADR 0038 freeze will fix this PC's cut on its
  first read after the day. A later merge then never reaches those rows.

## Bugs that need no sync (slice 0)

- a. Done (08b03c0fd, 4b2267f6e). A commit no reflog entry here wrote is dated by the reflog entry
  that brought it in, `authoredAt` keeps the author time, and its subject describes no row (ADR 0018).
- b. Done (5697e49bc). A block that ends before its session started carries no session.
- c. Done (f2c1e74ca, 44dce2135). A session silent until the prompt that ended a break draws no band
  inside it, a band in a break ends where its work did, and a single increment before a break no
  longer folds across it.
- d. Open. The day does not say "this machine was off until 19:26" (M5).
- e. Done (77ad9adb2). Only a day this app booked is frozen (ADR 0038).

## Decisions, one recommendation each

| Decision     | Recommendation                                                                                                                                                                                                | Code facts                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Day owner  | The machine you book from owns the day. The claim travels to the peers; the Tempo marker (description suffix + machine id, open M6 decision) is the lock while a peer is offline.                             | Ledger is local (`db.rs:16`); marker hard-coded `none` (`sync.ts:177`); `subtractForeignTime` matches per issue, not per interval (`subtract.ts:32`). |
| 2 Clock skew | Measure the offset at each handshake. Under 2 min: merge. 2-10 min: correct and warn. Over 10 min: refuse and name the machine.                                                                               | Rows are 15-minute steps (ADR 0017).                                                                                                                  |
| 3 Stream key | One stream per checkout, keyed by the normalized `origin` URL, with a path alias per machine (dir name, manual alias as fallback). Rules match through the alias.                                             | `streamKey` is `repo:<abs path>` (`block.ts:91`); rules keyed by path (`settings/parse.ts:112`); commit dedupe key holds the path (`dedupe.ts`).      |
| 4 Merge mode | Continuous pull with a cursor per origin. No freeze while a peer is behind for that day. A booked day that changes shows "changed after booking" and is not re-cut.                                           | The day is re-cut every tick; the ADR 0038 freeze drops late arrivals.                                                                                |
| 5 Peer needs | The same full app on every machine, credentials set up per machine; secrets never travel. The merge works with no Jira, Tempo or Google. Settings and stand-ins stay on the booking machine until slice 6.    | Secrets allowlist `secrets.rs:9`.                                                                                                                     |
| 6 Retention  | Raw events, filtered at the sender: exclusions applied, private-path time as a bare interval, transcripts never sent. Received events follow the 30-day retention by event time; spend stays with its origin. | Private link per path (`build-rows.ts:55`); ADR 0002 keeps spend.                                                                                     |

- **Discovery and pairing:** mDNS `_timetrack._tcp` (`mdns-sd` crate), manual host:port as fallback.
  A 6-digit code shown on one machine and typed on the other authenticates a key exchange (PAKE or a
  fingerprint compare).
- **Transport:** a long-lived key pair per machine in the keychain (`pair:<peer>`, off the
  `secrets.rs` allowlist like `database-key`). Mutual TLS with pinned certificates (rustls) on a
  separate LAN listener with a configurable port. Agent and ingest listeners stay on 127.0.0.1
  (`agent.rs:531`, `ingest.rs:418`).
- **Event identity:** the schema is at version 19 (`db.rs:513`), not 13. Migration 20 adds `origin`
  and `origin_seq` with UNIQUE(origin, origin_seq), filled with a machine UUID. Machine-local kinds
  (window, idle, input, lock, heartbeat) get the origin in their dedupe key. Shared facts (commit
  sha, prompt and turn ids, MR, calendar) do not, so two copies count once; the machine whose reflog
  says `commit` owns the commit.
- **macOS:** idle polled from `idle_ms`; lock from `com.apple.screenIsLocked`; no Accessibility grant,
  so app-only evidence; paths start `/Users/tom`; `NSLocalNetworkUsageDescription` and
  `NSBonjourServices` live in `src-tauri/Info.plist`; asleep, away and off look the same.

## Proposed slice order

0. Bugs a-e (S-M, 2-3 d).
1. Done. ADR 0039 + migration 20 (machine id, change counter, tombstones, `received_event`,
   `peer_cursor`) + `repoKeyOf`. The read fold and the stream key change wait for slice 4.
2. Pairing and transport, a "Paired machines" view with last-seen, and a status item in the sidebar next to Auto mode that shows the connected Timetrack instances (Tom, 2026-10-08); verify on ethlete-mac (M, 3-5 d). Done 2026-10-08.
   - 2a. Done (639dca492). Port 52741, override `TIMETRACK_PEER_PORT`; the ops are answered in the
     host, so the `ethlete-agents timetrack` CLI does not know them yet. Host: machine key and self-signed certificate (key in the keychain), SPAKE2 pairing on the
     6-digit code that binds both certificate fingerprints, `paired_machine` table (migration 21),
     mutual-TLS LAN listener with pinned certificates and a configurable port, a `hello` exchange that
     measures clock offset and updates last-seen. Agent ops `peers.list`, `pair.offer`, `pair.accept`,
     `peers.forget`, so pairing is verifiable without a click.
   - 2b. Done (365e2354b), op `peers.discovered`. Discovery: mDNS `_timetrack._tcp` advertise and browse (`mdns-sd`), manual host:port.
   - 2c. Done (1e1ec1c2f, 8230aab7b), host heartbeat every 60 s. UI: "Paired machines" in Settings (pair, forget, last-seen, clock offset) and the sidebar
     status item next to Auto mode. Fake ports for the e2e suite.
   - 2d. Done (3aad3faab). `Info.plist` next to `tauri.conf.json` carries `NSLocalNetworkUsageDescription`
     and `NSBonjourServices`; it lands in the bundle's `Contents/Info.plist`. `cargo test` on
     ethlete-mac: 232 passed. Paired tank (PC) and the MacBook through the agent ops: `pair.offer` on
     the PC, the PC found by `peers.discovered` on the Mac over mDNS, `pair.accept {machineId, code}`,
     `peers.hello` both ways. Both lists hold last-seen, address and a clock offset of 35 ms (Mac
     behind; `sntp` on the Mac agrees: 34 ms behind time.apple.com, the PC within 1 ms). A wrong
     code is refused over the LAN. Learned: macOS cannot read the signing identifier of an unsigned app,
     so it shows no local-network prompt and denies every LAN connect with "No route to host". An
     Intel debug build is unsigned, so ad-hoc sign it first (`codesign --force --deep -s - --identifier
io.ethlete.timetrack`). Every new signature asks for the keychain password about 10 times, so
     launch a test build on the Mac once and keep it running. The macOS firewall is off on ethlete-mac.
     The installed `/Applications/Timetrack.app` is arm64-only and does not run on this Intel MacBook.
3. Read-only overlay, the first user value: "Nobody was here" becomes "Worked on MacBook". No row
   changes (S-M, 2-3 d). In progress. Tom, 2026-10-08: the peer sends raw events per ADR 0039 (not
   derived windows), and booked rows are dropped from this slice (Tempo coverage already shows a
   booking from either machine; peer claims come in slice 5).
   - 3a. Done (77f6f8fc8). Host pull. New `Frame` variants for "changes after my cursor": the server answers only for a
     paired fingerprint (same check as `answer_hello`) and sends a page of its own `collected_event`
     rows by `changed_seq` plus `deleted_event` tombstones. The client upserts into `received_event`,
     applies tombstones, and advances `peer_cursor` in one transaction. Pull after each heartbeat
     hello. Op `peers.pull` and a Tauri command. Rust tests over loopback, including paging and a
     tombstone.
     Learned: a missed tombstone (retention) can leave a copy holding a key the peer has moved to a new
     row, so an incoming row evicts any received row of that machine with its `dedupe_key`.
   - 3b. Done (62554638a). Tauri command `received_between` and agent op `peers.received` read
     `received_event` for a range, joined to `paired_machine` for the name (a forgotten machine's
     copies are left out). TS port `peers.receivedBetween$` returns `ReceivedEvent` (machine id, name,
     event), kept apart from `eventsBetween$` per ADR 0039; the e2e fake seeds `world.peers.received`.
   - 3c. Done (3507c6d85). `peerAttendance` reads each machine's received events by the same test as
     `attendedAt` (not `presenceWindows`: attendance is what `markAttendance` compares), and
     `buildRows({ received })` hands them to `markAttendance` as `peers`. An unattended band a peer
     covers carries `workedOn` on the group, proposal, `ReviewedRow` and pinned row, still books
     nothing, and raises no `unattended-time` check. `unnamedLabelOf` shows "Worked on <machine>".
     Both day readers pass the received events. Unit specs and the e2e spec
     `worked-on-paired-machine.spec.ts`. Live: tank holds 86,555 events from the MacBook, and no
     unattended band of 10-02..10-08 lies within the 15 min grace of the Mac's presence, so the
     snapshot shows no row change.
   - 3d. The label and its e2e spec landed with 3c. Left: verify between tank and ethlete-mac (one new Mac build, signed
     with `macos-dev-sign.sh`, about 10 password prompts).
4. Full merge: replication per origin into `readDay$`, path aliases, commit dedupe, attendance across
   machines, spend per origin, sender filter (L, 1-2 wk). Steps below; 4d is the first that Tom sees
   (work done only on the Mac shows as rows on the PC). Retention of `received_event` by event time is
   already in `store.rs`. A step that changes rows runs `timetrack snapshot` before and `--compare`
   after, and explains every changed row.
   - 4a. Sender filter, first: today `changes_after` (`peer.rs`) sends every `collected_event` row
     as stored, and tank already holds 86,555 unfiltered MacBook events. Exclusion rules run before an
     event is stored, and transcripts live in `transcript_chunk`, which `changes_after` never reads, so
     the missing parts are private paths and rules added after collection. New `peer/filter.rs` reads
     `projectLinks` and `exclusionRules` from `settings_document`. An event whose `repoPath`, `cwd`,
     `workedIn`, `worktree` or `directory` lies under a private link, or a `window-focus` whose title
     names a private checkout's directory, goes out as a bare interval: new kind `private-interval`,
     `at` only. A current app-id rule drops the event; a title-pattern rule (`regex` crate) blanks the
     title, and a pattern that does not compile blanks every title (fail closed). `Frame::Changes`
     carries a hash of the filter inputs; a receiver that sees a new hash deletes that machine's
     received rows and resets its `peer_cursor` to 0, so the next pull is the filtered form.
     Migration 23 clears `received_event` and `peer_cursor` once. Files: `peer.rs`, `peer/filter.rs`,
     `db.rs`, `Cargo.toml`. Tests: `cargo test` over loopback (private repo path, agent cwd under a
     private root, private window title, app-id rule, title rule, bad pattern, a filter change causes
     a re-pull, no transcript text in any frame). Live: `peers.pull` on tank, then `peers.received`
     holds no private path.
   - 4b. Done (571b3c3d7). Tom, 2026-10-08: `streamKey` stays `repo:<local path>`; a peer path maps
     onto the local checkout with the same origin key (open question 1). Landed as migration 23, since
     4a is on hold; 4a takes the next free number. `readRepoKey$` reads the key; the git collector
     writes the map after each discovery; `receivedBetween$` returns `{ events, repoKeys }` (by machine
     id, a forgotten machine's left out), and both day readers take `events` only. A frame without
     the map (an older peer) keeps the stored one. Several local checkouts of one key: the shortest
     path wins. Left: the agent op `peers.received` on tank, after the next app restart.
     Path map. TS writes this machine's map from checkout path to `repoKeyOf(origin, path)`
     (remote from `git/state.ts`) to the host on each git discovery (new command `set_repo_keys`,
     table `repo_key`, migration 24). `Frame::Changes` carries the sender's map, the receiver stores
     it per machine (`peer_repo_key`), and `received_between` / `peers.receivedBetween$` return it
     with the events. Pure `translatePeerPath({ path, peerKeys, localKeys })` maps a peer path (and a
     path under a peer checkout) onto this machine's checkout of the same key, and keeps the peer path
     when no local checkout has that key. Nothing reads it yet. Files: `git/repo-key.ts`, new
     `libs/timetrack/src/lib/model/peer-path.ts`, `apps/timetrack/src/host/peers.ts`, the git wiring
     in the app, `peer.rs`, `db.rs`, the e2e fake. Tests: unit spec for the translation (prefix,
     no local checkout, Windows and `/Users` paths), `cargo test` for the map in a pull, the agent op
     `peers.received` on tank.
   - 4c. Done (7289dae85). `mergeDayEvents({ local, received, keys })` (`stream/merge-day-events.ts`)
     takes `ReceivedRange` and this machine's `CheckoutKeys`, returns `OriginEvent[]` (`origin: 'local'`
     or the peer's id and name) sorted by `at`. Agent sessions fold by their key too. Commits fold only
     across origins, so two local checkouts of one sha stay as today. `translatePeerPath` now keeps a
     trailing separator (`workedIn`). `private-interval` has source `private`. Nothing reads it yet.
     Read fold, pure: `mergeDayEvents({ local, received, keys })` returns one list, each event
     tagged with its origin. Peer paths go through 4b. Shared facts count once: calendar occurrence,
     merge-request event id, prompt id, turn id. Commits fold by sha: the copy with no `authoredAt`
     (the reflog wrote it) describes the row; a copy with `authoredAt` stays as presence at the pull
     on its own machine (ADR 0018). Machine-local kinds (window, idle, lock, pause, input, call,
     heartbeat, `private-interval`) never fold across origins. Files: new
     `libs/timetrack/src/lib/stream/merge-day-events.ts`, `model/event.ts` (`origin`,
     `private-interval`), `store/dedupe.ts`. Tests: unit spec per fold rule, including the 10-08
     shape (61 Mac commits pulled into tank).
   - 4d. The merge in the day, first visible value. `streamDay` takes the merged list and builds
     presence, focus and blocks per origin, so a focused window on the Mac never ends a block on the
     PC; the blocks of all origins go into one `buildRows`. Day presence is the union of the origins;
     a `private-interval` is private time with no link named. Both day readers (`read-day.ts`,
     `day-review.ts`) and `agent-day.ts` pass the merged list. A band of this machine that a peer's
     presence covers but its events do not explain keeps "Worked on <machine>" from 3c. Files:
     `stream/stream-day.ts`, `stream-day-options.ts`, the two readers. Tests: stream-day unit spec
     (Mac works while the PC is off, both work at once on two checkouts, one checkout on both), new
     e2e `merged-peer-day.spec.ts` seeding `world.peers.received`, `worked-on-paired-machine.spec.ts`
     unchanged, snapshot compare for 10-02..10-08.
   - 4e. Attendance across machines: a break, an away stretch and an unattended band need every
     origin away; `promptOriginAt` reads input from all origins, so a prompt typed at the Mac is not
     phone time on the PC; the `unattended-time` check reads merged attendance. Files:
     `rows/attended.ts`, `stream/prompt-origin.ts`, the break pass in `stream-day.ts`. Tests: unit
     specs, e2e `remote-phone-time.spec.ts` and `unattended-band.spec.ts` gain a peer case,
     snapshot compare.
   - 4f. Spend per origin: a received turn is priced here and counted once (4c), `StreamSpend`
     carries a split by machine, and the day streams and Sources views show the share spent on each
     machine. Compaction reads only `collected_event`, so a received turn is never compacted (ADR
     0002). Files: `stream/stream-day.ts` (spend), `day-review/day-streams.component.ts`,
     `sources/inventory.ts`, `store.rs` test. Tests: unit spec, `cargo test` that compaction leaves
     `received_event` alone, e2e `day-streams.spec.ts` peer case.
   - 4g. Manual alias: settings field `repoAliases` (checkout path to key) overrides `repoKeyOf` on
     both sides, set in the project paths view. Coordinate first: another session is editing
     `settings/model.ts` and `settings/parse.ts`. Files: settings model and parse, project paths
     view, the 4b map writer. Tests: parse spec, e2e `project-paths.spec.ts` alias case.
   - 4h. "Changed after booking": a booked (frozen) day whose merged read now differs from
     `frozenRows` shows the note and is not re-cut (decision 4). Files: `day-review.ts`, the day
     header. Tests: unit spec, e2e `booked-day-frozen.spec.ts` peer case.
   - 4i. Verify between tank and ethlete-mac (one Mac build, about 10 password prompts): Mac-only
     work of a day shows as rows on tank, a private checkout arrives as bare intervals only.
   - Open for Tom. (1) 4b realizes decision 3 by mapping a peer path onto the local checkout of the
     same origin key, so `streamKey` stays `repo:<local path>` and stored lane keys, edits, pins and
     path rules keep working. Spelling `streamKey` as `repo:<origin key>` instead would need a
     migration of all of them. Recommendation: map onto the local path. (2) A title-pattern rule the
     Rust `regex` crate cannot compile (a JS-only construct): blank every window title sent, or send
     titles unfiltered by that rule. Recommendation: blank them (fail closed) and show the rule as
     invalid, as the settings screen already does for a rule that does not compile.
5. One owner and an incomplete day: claim + Tempo marker, the other machine refuses to book, the
   freeze waits for peers, "MacBook not seen since X" (M, 3-4 d).
6. Settings and stand-ins replicated (M, optional).
