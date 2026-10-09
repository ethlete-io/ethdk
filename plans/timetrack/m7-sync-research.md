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

| Decision     | Recommendation                                                                                                                                                                                                 | Code facts                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Day owner  | The machine you book from owns the day. The claim travels to the peers; the Tempo marker (description suffix + machine id, open M6 decision) is the lock while a peer is offline.                              | Ledger is local (`db.rs:16`); marker hard-coded `none` (`sync.ts:177`); `subtractForeignTime` matches per issue, not per interval (`subtract.ts:32`). |
| 2 Clock skew | Measure the offset at each handshake. Under 2 min: merge. 2-10 min: correct and warn. Over 10 min: refuse and name the machine.                                                                                | Rows are 15-minute steps (ADR 0017).                                                                                                                  |
| 3 Stream key | One stream per checkout, keyed by the normalized `origin` URL, with a path alias per machine (dir name, manual alias as fallback). Rules match through the alias.                                              | `streamKey` is `repo:<abs path>` (`block.ts:91`); rules keyed by path (`settings/parse.ts:112`); commit dedupe key holds the path (`dedupe.ts`).      |
| 4 Merge mode | Continuous pull with a cursor per origin. No freeze while a peer is behind for that day. A booked day that changes shows "changed after booking" and is not re-cut.                                            | The day is re-cut every tick; the ADR 0038 freeze drops late arrivals.                                                                                |
| 5 Peer needs | The same full app on every machine, credentials set up per machine; secrets never travel. The merge works with no Jira, Tempo or Google. Settings and stand-ins stay on the booking machine until slice 6.     | Secrets allowlist `secrets.rs:9`.                                                                                                                     |
| 6 Retention  | Raw events, filtered at the receiver at read time (its own exclusion rules and private links); transcripts never sent. Received events follow the 30-day retention by event time; spend stays with its origin. | Private link per path (`build-rows.ts:55`); ADR 0002 keeps spend.                                                                                     |

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
   - 4a. Dropped (Tom, 2026-10-09). Both machines are his own and received events sit in the same
     encrypted store, so the receiver applies its own private links and exclusion rules at read time
     (4d) instead of the sender filtering. Transcripts are never sent.
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
   - 4d. Done (4fc778680). `streamDay` reads each origin of an `OriginEvent` list as its own day
     (`streamOrigin`), joins the blocks with `blocksFromSpans`, unions presence, and keeps a break or
     gap only where every other origin was away. `StreamDay.peerLanes` hands each peer's blocks by lane
     to `buildRows`, so a band is attended where its own machine saw a person; attendance from local
     events stays local, so 3c's "Worked on" holds. Both readers merge with `mergeDayEvents`, which now
     takes this machine's exclusion rules (`exclusionFilter`); private links apply as for local events.
     `received_between` returns `ownRepoKeys`. Snapshot 10-02..10-08: 12 new unnamed rows on 10-03/04
     in `repo:/Users/tom/dev/ethlete-sdk` (the Mac sends no keys yet, so its paths stay its own until
     the 4j build); 10-08 is frozen and unchanged (4h). `private-interval` is unused since 4a is dropped.
     Plan as written: The merge in the day, first visible value. `streamDay` takes the merged list and builds
     presence, focus and blocks per origin, so a focused window on the Mac never ends a block on the
     PC; the blocks of all origins go into one `buildRows`. Day presence is the union of the origins;
     a `private-interval` is private time with no link named. Both day readers (`read-day.ts`,
     `day-review.ts`) and `agent-day.ts` pass the merged list. A band of this machine that a peer's
     presence covers but its events do not explain keeps "Worked on <machine>" from 3c. Files:
     `stream/stream-day.ts`, `stream-day-options.ts`, the two readers. Tests: stream-day unit spec
     (Mac works while the PC is off, both work at once on two checkouts, one checkout on both), new
     e2e `merged-peer-day.spec.ts` seeding `world.peers.received`, `worked-on-paired-machine.spec.ts`
     unchanged, snapshot compare for 10-02..10-08.
   - 4e. Done (12637f9c3). `promptOriginReader({ elsewhere })` reads each other machine's input, so a
     prompt any seat was touched for is a desk prompt and buys no phone time that cuts a Mac band.
     `attendedAt({ elsewhere })` keeps an away stretch as a wall only where no paired machine saw a
     person, so this machine's grace reaches a band left running when the user moved to the Mac. Breaks
     and gaps were already 4d; the `unattended-time` check already skips a `workedOn` band (3c), and
     3c's "Worked on" stays for a band no local instant comes near. Snapshot 10-02..10-08 unchanged
     (10-09 live: one new fifagg stand-in row from work after the baseline, one ET-772 hand edit).
     Plan as written: Attendance across machines: a break, an away stretch and an unattended band need every
     origin away; `promptOriginAt` reads input from all origins, so a prompt typed at the Mac is not
     phone time on the PC; the `unattended-time` check reads merged attendance. Files:
     `rows/attended.ts`, `stream/prompt-origin.ts`, the break pass in `stream-day.ts`. Tests: unit
     specs, e2e `remote-phone-time.spec.ts` and `unattended-band.spec.ts` gain a peer case,
     snapshot compare.
   - 4f. Done. `StreamSpend.peers` holds each paired machine's share (`MachineSpend`: turns and
     usage), on every stream, the day's total, the unattributed and the app's own spend; absent on a
     day only this machine spent. Received turns were already priced here and counted once (4c). The
     day streams show "2 turns on MacBook" (`data-spend-peers`); the Sources view says so on the spend
     source. Unattended per machine (the 4e point Tom accepted): a stream's agent-alone time leaves
     out what another machine's presence covers, so the day total no longer holds time spent at the
     Mac. That time is in neither engaged nor unattended on the stream line. No `cargo test`: no
     compactor exists (ADR 0002 "Not built"), and retention by event time is already tested.
     Plan as written: Spend per origin: a received turn is priced here and counted once (4c), `StreamSpend`
     carries a split by machine, and the day streams and Sources views show the share spent on each
     machine. Compaction reads only `collected_event`, so a received turn is never compacted (ADR
     0002). Files: `stream/stream-day.ts` (spend), `day-review/day-streams.component.ts`,
     `sources/inventory.ts`, `store.rs` test. Tests: unit spec, `cargo test` that compaction leaves
     `received_event` alone, e2e `day-streams.spec.ts` peer case.
   - 4g. Done. Settings field `repoAliases` (checkout path to key, trimmed, lower-cased) and
     `withRepoAliases` (`model/peer-path.ts`). The git collector writes this machine's map with the
     aliases applied, and writes it again within one poll when an alias changes, so the alias reaches
     both this machine's reads (`ownRepoKeys`) and the peer (the map in every pull). The readers are
     unchanged. Set under Settings → Projects, "Same repository on a paired machine"; the same alias is
     set on each machine. Tests: parse and peer-path specs, e2e `project-paths.spec.ts` (set and
     remove) and `merged-peer-day.spec.ts` (a Mac clone with another origin lands on the aliased
     checkout). Slice 6 scope: `repoAliases` names paths, so it is a `machine` field.
     Plan as written: Manual alias: settings field `repoAliases` (checkout path to key) overrides `repoKeyOf` on
     both sides, set in the project paths view. Coordinate first: another session is editing
     `settings/model.ts` and `settings/parse.ts`. Files: settings model and parse, project paths
     view, the 4b map writer. Tests: parse spec, e2e `project-paths.spec.ts` alias case.
   - 4h. Done. `frozenDayPeerBands` (`review/frozen-rows.ts`) takes each paired machine's lanes from
     the merged read (`StreamDay.peerLanes`) minus what the frozen rows hold in that lane (attended
     proposals and unnamed rows), drops pieces under 5 min, and marks a band `booked` when the merged
     read names an issue for it that the day's foreign Tempo coverage holds; the timeline draws them
     read-only in their lane as "Booked on <machine>" / "Worked on <machine>" (`data-peer-band`), and
     opens a lane the frozen rows lack. `changedAfterBooking` is true when the read's per-lane covered
     time differs from the frozen rows by at least one 15 min increment (a renamed band is no change);
     the day header then says "Changed after booking". The rows stay frozen. Machine names come from
     the paired list. Tests: frozen-rows spec, e2e `booked-day-frozen.spec.ts` (the MacBook paired
     after the freeze). Full Timetrack e2e: 476 passed.
     Plan as written: "Changed after booking": a booked (frozen) day whose merged read now differs from
     `frozenRows` shows the note and is not re-cut (decision 4). Files: `day-review.ts`, the day
     header. Tests: unit spec, e2e `booked-day-frozen.spec.ts` peer case. Tom, 2026-10-09: the
     frozen day also draws a peer's work as read-only bands labeled "Booked on <machine>", so 10-08
     shows the MacBook's 13:15-18:00 and not an empty gap.
   - 4i. Done (9ea342ab9, 82959b851, 8c210453e; Tom approved the design 2026-10-09). A booked day draws a
     paired machine's own rows. On 10-08 tank showed no "Booked on" band (it names no issue for the
     Mac's work: the Mac named its rows with its own rules, auto answers and pins), the bands were
     raw-block fragments, Mac app ids became lanes, and "Changed after booking" fired for the peer time
     the bands already showed. Decisions:
     - Wire: migration 25 adds `day_rows` (this machine's rows per day, on the ADR 0039 change clock by
       trigger) and `received_day_rows` (the last version per machine and day). `Frame::Changes`
       carries `dayRows` in the same pages as events; `received_between` (and the `peers.received` op)
       returns the rows of the days that start in the range. Not a collected event: an event is an
       observation (ADR 0039), and an older peer would read an unknown kind as one. An older receiver
       ignores the field; an older sender sends none, and tank then draws the 4h raw bands.
     - Payload (`PeerDayRows`, `review/peer-rows.ts`): the day, `frozen`, and per attended repo-lane row
       the lane key, window, issue key or stand-in name, description, state (`booked` when the ledger
       holds it, with its Tempo worklog id; `accepted` for accepted, edited or synced; else `suggested`).
       No evidence; hidden, unattended and app-lane rows are never sent.
     - Sent by the day screen when its rows change (2 s debounce, the host keeps the change number when
       the rows are equal) and by an agent read that freezes a day. A day nothing reads sends nothing.
     - Drawn as sent, read-only, in the lane `mapPeerDayRows` moves onto the local checkout (4b map,
       4g aliases): "Booked on <machine> · ISSUE" or "Worked on <machine> · ISSUE/name". Not cut by the
       frozen rows; a frozen row draws over a band. Repo lanes only, also for the raw fallback. The
       machine name is the paired label (a rename wins), as in 4h.
     - `changedAfterBooking` leaves out each lane's peer time: raw peer blocks and sent rows widened to
       whole 15 min increments, plus each current row they cover at least half of (the cut filled the
       gaps between fragments). The 4h e2e case that expected the note for the Mac's work now expects
       none, as approved.
     - Retention deletes both tables by day start, with the events.
       Tests: `peer-rows.spec.ts`, `frozen-rows.spec.ts`, `cargo test` (pull carries the last rows per
       day, equal rows keep the change number, forgotten machine left out, retention), e2e
       `booked-day-frozen.spec.ts` (rows handed on freeze and on screen, sent rows drawn booked and named
       in the mapped lane, raw fallback without app lane, no "Changed after booking" from peer time).
       Snapshot 10-03..10-09: no row changed by this step (10-09 live: one fifagg-frontend row grew one
       increment with new work). Full Timetrack e2e: 493 passed, 1 flaky (`masked-names`, unrelated).
   - 4i follow-up. Done (aaeb2e55e, d7deeccd0). The day rows recover by themselves, with no day opened by hand: 4i sent rows only
     from the day screen and a freezing agent read, so a Mac updated from next.10 never sent the days it
     had booked, and an older receiver's cursor moved past the `dayRows` it skipped. Decisions:
     - Backfill (`peers/day-rows-backfill.ts`): at startup and whenever a new machine is paired, each
       machine takes the booked (ledger) days of the last 30 finished ones, and builds through the
       headless agent read (`agentDay.sendDayRows$`, never navigating) each day whose `day_rows` entry is
       missing or older than `PEER_DAY_ROWS_VERSION`, one day per 2 s. Only machines with a paired peer
       run it. The read freezes a booked unfrozen day as any agent read does; frozen rows never change.
     - Payload version: `encodePeerDayRows` stamps `version` (`PEER_DAY_ROWS_VERSION`, now 1; raise it
       when the row builder changes what a day sends). Rows stored before carry none and count as 0, so
       each machine rebuilds them once; the store keeps the change number when the rows are equal.
     - Cursor gap: no new cursor and no migration. `Frame::Pull` gains optional `dayRowsFromMs`. While a
       receiver holds no `received_day_rows` of a machine, every pull asks for the rows of the days from
       30 days ago, and the sender adds those changed at or before the receiver's cursor to the page
       (later ones arrive through the cursor anyway). The first answer that holds rows ends it, so it
       runs once; a sender with no rows in the window answers an empty list. An older sender ignores the
       field. A receiver keeps the raw rows, so a version rise on its side loses nothing; a version rise
       on the sender's side rebuilds the rows and they arrive through the cursor.
     - New host command `own_day_rows` (this machine's stored rows from a day on).
       Tests: `peer-rows.spec.ts` (version stamp, days to rebuild), `cargo test` (catch-up after a
       skipped page, none outside 30 days, none once held, an older pull frame), e2e
       `booked-day-frozen.spec.ts` (a booked day nothing opened is sent at startup and drawn "Booked on
       PC · ABC-3010" on the peer; fails without the backfill). Full Timetrack e2e: 498 passed. Snapshot
       10-03..10-09: no booked row changed (10-09 live: one ET-772 row grew with new work).
   - 4j. Verify between tank and ethlete-mac (one Mac build, about 10 password prompts): Mac-only
     work of a day shows as rows on tank, Mac lanes map onto the local checkout (the Mac build in use
     on 2026-10-09 predates 4b, so its rows sit in `repo:/Users/tom/...` lanes), a private checkout
     shows as a bare interval. Also check that the rebuild asks for no keychain password.
   - Open for Tom. (1) 4b realizes decision 3 by mapping a peer path onto the local checkout of the
     same origin key, so `streamKey` stays `repo:<local path>` and stored lane keys, edits, pins and
     path rules keep working. Spelling `streamKey` as `repo:<origin key>` instead would need a
     migration of all of them. Recommendation: map onto the local path. (2) A title-pattern rule the
     Rust `regex` crate cannot compile (a JS-only construct): blank every window title sent, or send
     titles unfiltered by that rule. Recommendation: blank them (fail closed) and show the rule as
     invalid, as the settings screen already does for a rule that does not compile.
5. One owner and an incomplete day: claim + Tempo marker, the other machine refuses to book, the
   freeze waits for peers, "MacBook not seen since X" (M, 3-4 d).
6. Settings and stand-ins replicated (M). Tom approved the design on 2026-10-09; build it after 4h.
   Today the settings are one JSON row (`app_setting`, `store.rs:550` and `:588`) saved whole, with
   no timestamps, so a synced write would overwrite the other machine.
   - Scope per field, fixed in code next to `TimetrackSettings` (`settings/model.ts:269`):
     `shared` or `machine`. A `machine` field never leaves its machine. `machine`: `gitScanRoots`,
     `lockWindow`, `lockAfterIdleMs`, `transcribeCalls`, `transcribeLanguage`, `noWorkContextApps`,
     `holdsWorkApps`. Everything else is `shared`, including `display` (Tom, 2026-10-09). A new field
     must name its scope; a spec fails when one does not.
   - Merge per scalar field and per list item, never per document. Each scalar field and each list
     item (rules, links, stand-ins, namings) carries `updatedAt` and the machine id of the write; the
     newer write wins, the machine id breaks a tie, and the peer's `clockOffsetMs` corrects the time.
     A deleted item leaves a tombstone.
   - A path travels as a repo key, not as a path: `attributionRules` `repoPath`/`workPath`,
     `projectLinks.path`, `noStandInCheckouts`, `standIns.openedForWorkPath`. The receiver maps the key
     onto its local checkout through the 4b map and `repoAliases` (4g). With no local checkout the
     item is stored but inactive, and shows so in the settings.
   - Wire: a new peer message `settings` next to `hello` and `pull` (dispatch at `peer.rs` ~987),
     over the same pairing and TLS. Secrets never travel (decision 5).
   - First sync is reviewed: the two machines already differ, so the first exchange with a peer lists
     every difference and Tom picks per item. After that, changes apply automatically, and a changed
     field or item shows "changed on <machine>".
   - A synced write is a human write from another machine; agents still cannot write settings
     (`plans/timetrack/auto-mode.md:42`).
   - Open: the step split (files and tests per step), written when this item starts.
