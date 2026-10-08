# M7 sync: research and recommendations (2026-10-08)

Input for the six open decisions in [`roadmap.md`](./roadmap.md) "M7: One day, every machine". Nothing
here is decided. Tom decides each point; then record the merge and event identity in an ADR.

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

- a. A commit that arrives by pull or fast-forward (reflog) is neither presence nor a band. Use the
  time this machine first saw it.
- b. A block never takes a session that started after the block.
- c. The 15-minute rounding at the start of a break drops attended minutes and leaves an empty
  unattended band.
- d. The day does not say "this machine was off until 19:26" (M5).
- e. Freeze only a day this app booked, or wait for paired machines before the freeze.

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
  so app-only evidence; paths start `/Users/tom`; macOS 15 needs `NSLocalNetworkUsageDescription` and
  `NSBonjourServices` (no `Info.plist` yet); expect a firewall prompt; asleep, away and off look the
  same.

## Proposed slice order

0. Bugs a-e (S-M, 2-3 d).
1. ADR + migration 20: event identity, dedupe policy, canonical repo key (S, 1-2 d).
2. Pairing and transport, a "Paired machines" view with last-seen; verify on ethlete-mac (M, 3-5 d).
3. Read-only overlay, the first user value: the peer sends presence and attendance intervals, booked
   rows and stream labels. "Nobody was here" becomes "Worked on MacBook". No row changes (S-M, 2-3 d).
4. Full merge: replication per origin into `readDay$`, path aliases, commit dedupe, attendance across
   machines, spend per origin, sender filter (L, 1-2 wk).
5. One owner and an incomplete day: claim + Tempo marker, the other machine refuses to book, the
   freeze waits for peers, "MacBook not seen since X" (M, 3-4 d).
6. Settings and stand-ins replicated (M, optional).
