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
   machines, spend per origin, sender filter (L, 1-2 wk).
5. One owner and an incomplete day: claim + Tempo marker, the other machine refuses to book, the
   freeze waits for peers, "MacBook not seen since X" (M, 3-4 d).
6. Settings and stand-ins replicated (M, optional).
