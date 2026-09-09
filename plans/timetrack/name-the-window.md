# Name the unnamed window

Agreed with Tom on 2026-09-09, in a full pass over the design tree. This plan answers the
**Known weak** paragraph of slice 1 in [`vertical-slices.md`](./vertical-slices.md), and it
replaces that paragraph's two held-back fixes with a different mechanism.

It is not a slice. A slice delivers something the user asked for; this delivers a number that
stops lying.

## The problem

A focused window is named by its title. `reposByName` indexes every discovered checkout by its
directory name and looks for that name in the title (`libs/timetrack/src/lib/stream/stream-day.ts:360`).
Two kinds of window defeat it:

- **A terminal.** Its title names a command, a host or a shell, and the day's agents run in it.
- **A browser on a dev server.** `localhost:4200 — Mozilla Firefox` names no checkout, and no
  string in it ever will.

Both fall through to the sticky, which holds the last named checkout for `repoStickinessMs`
(5 minutes, `stream-day.ts:680-687`). After that their time folds into the Other applications
line.

### What is not known

**No measurement of this exists.** The "5 minutes against 25" example in
[`vertical-slices.md`](./vertical-slices.md) is an illustration, not an observation. The nearest
real number is ADR 0006's, measured on 2026-09-07: the screen showed 21 minutes and one Other
applications line, against 18 commits and 15 768 agent turns between 09:57 and 18:57.

So this plan starts with a measurement, and the order of everything after it is decided by that
number. See step 0.

## The rule this plan obeys

**Only evidence names a checkout.** A path a process really holds is evidence. A timer is not, and
a title that happens to contain a directory name is not.

Slice 1's promise is that exactly one thing can be wrong with a line. The 5-minute sticky is
already one guess. A second guess — "an agent runs in this checkout, so the terminal in front is
that checkout" — is cheap and it is wrong on a day with two terminals on two checkouts, which is
the normal day here. It is written down here as the fallback for a platform where no process read
exists, and it is not built.

## Step 0: measure, before a collector changes

**Built on 2026-09-09.** `streamDay` reports `focusMs` and `unnamedFocus`, computed in the pass that
builds the folded line, so the two can never disagree. `UnnamedFocusComponent` in the Sources view
shows it for today and for the last 14 days, and `apps/timetrack-e2e/src/unnamed-focus.spec.ts`
covers it. Nothing below has started; the number decides the order. The first reading is below.

A panel in the **Sources** view reports the focus time that named no checkout, grouped by
application id, for the day and for the last 14 days.

- The store runs on SQLCipher (`apps/timetrack/src-tauri/Cargo.toml:24`), so its key lives in the
  keychain and no outside script can read a day. The measurement runs inside the app.
- The panel **stays**. Every rung changes the number, and the exit test reads it twice. A
  throwaway button would delete exactly the code the test needs.
- It reports on the collectors, not on the day, so it belongs in the Sources view and not on the
  Today screen.

Three kinds of time land in it, and only the first is a defect:

| What                                        | Verdict                    |
| ------------------------------------------- | -------------------------- |
| A window that names no checkout, and should | The defect this plan fixes |
| A window on a **private** checkout          | Already correct            |
| A window that is no work context at all     | Already correct            |

**The panel cannot tell the first kind from the third.** Both are `no-name`, and nothing collected
so far separates them, so the panel names the cause and does not claim the time as wrong. Rung 3 is
what splits the line. The first reading is what forced this: it called 1h 45m of chat a defect.

The private part gets its own row, marked as correctly unnamed. It is never taken out of the
total: the total has to reconcile with the Other applications line, or no other screen agrees with
it. The row names an application and never a path.

The panel also counts the disagreements described under "Which name wins". Many of them mean one
of the two readers is wrong, and the plan is then not done. **Not built:** there is no second reader
until rung 1, so there is nothing yet to disagree with. A fourth cause is reported instead, a name
two checkouts share, which is a defect rung 1 fixes for free.

### The first reading, on Linux, 2026-09-09

```
Last 14 days: 4h 10m of 8h 6m focused named no checkout. That is 51%.

timetrack                                          1h 39m  this app
com.slack.Slack                                    1h 1m   no checkout in the title
discord                                            44m     no checkout in the title
google-chrome                                      41m     no checkout in the title
code                                               5m      no checkout in the title
```

Five things it says, none of them predicted:

1. **No terminal appears at all.** This plan's premise is that a terminal and a dev-server tab lose
   the time. Against this number rung 1 recovers the 5 minutes of `code` and nothing else. **Rung 1
   is not obviously the first rung.**
2. **Chat is 1h 45m.** Slack and Discord are the third kind above, already correct, and the panel
   read them as a defect until this reading. Rung 3 is what the number asks for first.
3. **`google-chrome`, 41m, is the one unknown row.** It is either a dev server (rung 2) or a real
   website (correctly unnamed). Nothing says which, and rung 2 is worth building only if it is the
   former.
4. `timetrack` at 1h 39m is a fifth of all focus: the app watched while it was built. On purpose.
5. **The sample is thin.** 8h 6m of focus in 14 days, because most of them were worked on the Mac.
   A rung order decided on eight hours is a guess, so read the panel again after an ordinary Linux
   week.

### The second reading, on Linux, 2026-09-09, and what it changed

```
Last 14 days: 4h 22m of 8h 50m focused named no checkout. That is 49%.

timetrack          1h 46m  this app            on purpose
com.slack.Slack    1h 1m   no work context     on purpose
discord            44m     no checkout         never names one
google-chrome      42m     no checkout         never names one
code               8m      no checkout         names one elsewhere
Alacritty          1m      no checkout         never names one
```

Rung 3 works: the 1h 45m of chat the first reading called a defect is now `on purpose`, and the
whole unnamed line splits into 2h 47m on purpose, 8m of gap and 1h 27m of unknown.

**Rung 1 is not worth building on this machine.** `Alacritty` is 1m and `code` is 8m, so rung 1
recovers at most 9m of 8h 50m. Two readings, 14 days apart, both say a terminal loses almost nothing
here. This plan's premise was that a terminal loses the day. On Linux it is wrong. No Mac reading
exists yet, and the Mac is where the terminal days are.

**The panel cannot be judged from, and that is the next thing to fix.** Asked whether
`google-chrome`'s 42m was a dev server, Tom answered "42 minutes beginning when? in the last hour?
hard to relate". The panel reports an application and a span total, and drops two things the store
already holds: when the minutes happened, and the window title.

The window title is the evidence, not a hint. A title reading `localhost:4200 — …` answers the rung 2
question outright, with no recall and no rung. Asked about Discord, Tom told the rooms apart by their
names - a 09:15 meeting in a room whose name starts with `Meeting`, against an `open room` for
off-topic talk that sometimes carries project work - and the room name is in the window title.

So the next step is not a rung. It is **to group a row by its window titles**, biggest first, so the
row carries what it takes to judge it. That is what "measure before a collector changes" meant.

**A judgement per title is left open.** `noWorkContextApps` is per application, so it cannot say that
one Discord room holds work and another does not. Widening `title-pattern` was already rejected under
**Privacy**, for a related reason. Revisit it with the title numbers in hand, and never before.

### The titles behind a row. Built on 2026-09-09.

Each `UnnamedFocus` row now carries the distinct window titles behind it, each with its own total,
longest first (`libs/timetrack/src/lib/stream/unnamed-focus.ts`). `streamDay` folds them in the same
pass that folds the row, from the title it already holds at the `window-focus` branch of the sample
loop, so no second reader can drift from the folded line. A span sums a title across days the way it
sums a row. In the panel the row opens to show them
(`apps/timetrack/src/app/sources/unnamed-focus.component.ts`), and stays as it was when closed.

A title under `READABLE_MS` is dropped, the same as a row, and the open row says what the dropped
ones add up to, so it still reconciles with the total above it.

**A private checkout keeps no title.** A title carries the checkout's name, and the private project
link exists to hold that name out of every report. The row still counts the minutes, it just has
nothing to open. `streamDay`'s spec asserts the name is absent from the whole report.

**When the minutes happened is still dropped.** The second reading named two missing things and this
built one of them. A row is a span total with no clock, so `google-chrome` at 42m still cannot be
placed in the day. Build that only if a reading with the titles in hand still cannot be judged.

## The platform seam

The window source answers one new question: **can this platform name the process of the focused
window?**

| Platform                           | Answer                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| macOS                              | Yes. The source already holds the pid (`src-tauri/src/window_macos.rs:47`).              |
| Linux, through the wlr protocol    | No. A toplevel reports `app_id`, `title` and `state` only (`window_wayland.rs:149-161`). |
| Linux, through a compositor socket | Yes, where the compositor has one.                                                       |

Nothing may depend on one compositor. niri is the first reader, because it is a machine we run and
`plans/timetrack.md:296-298` already records its `niri msg -j focused-window` output with the `pid`
field. Hyprland (`HYPRLAND_INSTANCE_SIGNATURE`) and Sway (`SWAYSOCK`) are the same shape and about
40 lines each, behind the same seam. **No layer above the platform learns which compositor
answered.**

Rejected: match the focused `app_id` against the process list and take the process that matches.
That is a guess, and the rule above refuses it.

### The failure has to be visible

A machine whose compositor gives no process id must say so, or a large folded line reads as a wrong
number instead of a missing capability.

1. **A capability row in the Sources view. Built on 2026-09-09.** `WindowSourceStatus` carries a
   `capabilities` list, one entry per thing the source reads about the focused window: `app-id`,
   `title` and `working-directory`. The host fills it from the running source's kind
   (`window.rs:capabilities_of`), so no screen above the host reads a kind to work out what a
   platform can see, and a new platform source adds a row to that one table. Under wlr the working
   directory names the protocol as the reason; under macOS it names that no source reads one yet.
   A source that is not running claims nothing.
2. **One sentence on the Today screen**, under the Other applications line: how much could not be
   named, and that this machine cannot read a window's working directory. **Not built.**

Both are about the machine. Neither says the user's setup is wrong.

## Rung 1: the terminal's own directory

Read the focused window's process, and walk **down while there is exactly one child**.

- A `cd` moves the shell's own directory, so the window's own process covers the plain case.
- The walk covers a shell that runs a long command in a subdirectory.
- The walk stops at a process with several children, because which of them holds the work is a
  guess.

**Read at each focus sample, never on an interval.** Every collector here is edge-triggered, and
`plans/timetrack.md:635` deliberately refuses to add a periodic sample. The cost is a `cd` inside a
window that keeps focus for an hour, and the shell hook covers that case if the number says it
matters.

## Rung 2: the dev server behind a port

A browser window on `localhost:4200` cannot be named from its origin. It can be named from its
port: read which process listens on 4200, then read that process's working directory.

- **Finding the port.** Match `localhost:<port>`, `127.0.0.1:<port>` and `0.0.0.0:<port>` in the
  title, and nothing else. A bare `:3000` appears in commit messages, error logs and chat windows,
  and a wrong checkout is worse than an unnamed one.
- **Finding the process.** Read `/proc/net/tcp` directly on Linux. Shell out to
  `lsof -nP -iTCP:<port> -sTCP:LISTEN` on macOS, because socket enumeration through `libproc` means
  a walk over every process — a lot of code to save one short-lived spawn.
- **Resolve once per port**, cached for the run of the app. A dev server outlives the day, and a
  cache miss is how a restarted server is read again.

This rung needs **no** process id from the compositor, so it works the same on both platforms.

**It replaces the browser reporter idea in `plans/timetrack.md` completely.** That idea needed a
browser extension, an origin allowlist, and a deliberate change to the endpoint's refusal of any
request carrying an `Origin` header (`src-tauri/src/ingest.rs:333-340`). A tab on a real website
still names nothing, and that is correct: to read production is not to work on a checkout.

## Rung 3: say why an application has no name

**Built on 2026-09-09**, first, because step 0's number pointed here: 1h 45m of the 2h 32m the panel
called a defect was chat.

The evidence is the span itself. `streamDay` reports `namedApps`, the applications whose focused
window held a checkout at some point in the day, and `unnamedFocusOver` reads a row against the
union of them over the span:

| The row                                       | Verdict      | What it means                                           |
| --------------------------------------------- | ------------ | ------------------------------------------------------- |
| `private`, `own-window`                       | `on-purpose` | The cause settles it; the span is not asked             |
| `ambiguous-name`                              | `gap`        | The paths differ, so the window is nameable             |
| `no-name`, and the application named one else | `gap`        | It holds work and lost this stretch                     |
| `no-name`, and it never named one             | `unknown`    | No work context at all, or a name no collector can read |

`unknown` is the honest answer, not a hedge. Rung 1 and rung 2 are what move a row out of it, and a
number the user cannot act on is what the panel used to report.

An application no rung will ever name a checkout for would otherwise stay `unknown` for ever, so the
user can say so: `noWorkContextApps` in the settings, written from a control on the panel row
itself. A short list ships as well, in `DEFAULT_NO_WORK_CONTEXT_APPS` — media players, and the
messengers whose calls `TimetrackCallRules` already counts instead of their window. **Discord is
deliberately absent**: it is the one of them a team may run a working session in all day. Every entry
is reversible one application at a time through `holdsWorkApps`, so a team that works in one of them
keeps the rest of the list. It is a fifth cause rather than an exclusion rule — the minutes stay in the day and still
reconcile with the Today screen, and a declared application whose title does name a checkout still
names it.

## The model change

`WindowFocusEvent` gains an optional working directory.

- **One event, one instant, no join.** The fact is a property of the focused window and of nothing
  else, and the same source observes it at the same instant.
- **Resolved to a discovered repository root before it is stored.** A path that is no root is
  stored as nothing. The pipeline only ever uses the root, so a full home-directory path is data
  the app has no use for — and "a source stores only what it needs" is what the Sources view
  promises the user in writing.
- **A stored day from before this ships can never gain a working directory.** That is why the exit
  test needs a live day.

Rejected: a `process` source of its own, with a join on the instant. It buys a per-source retention
rule for data that dies with its window event, and it adds a join that can fail. Rejected as well:
post it as an `editor-heartbeat` with another reporter name. A terminal would then count as an
editor everywhere, and the heartbeat's rule that it adds no time is a rule about editors, not about
processes (`stream-day.ts:432`).

When this is built it needs its own ADR, because the field is hard to remove once days hold it.

## Which name wins

A window can now carry two names: a title that matches a checkout by directory name, and a working
directory that resolves to another one. An editor whose title says `api — repo-a` while its process
sits in the home directory is the ordinary version.

**The working directory wins.** The title is read only where there is no directory. A path is an
observation; a title match is a string coincidence, which is why a directory name two checkouts
share is dropped today rather than resolved (`stream-day.ts:369-374`).

That drop is also what this fixes for free: two checkouts called `api` have different paths, so an
ambiguous name becomes nameable.

## What the new names do to the sticky

A named window **sets** the sticky, and the sticky stays application-scoped as it is today
(`stream-day.ts:687`). A tab on `localhost:4200` names the checkout; switch to the documentation
tab in the same browser, and the next five minutes still belong to it. That is the sticky doing its
job with evidence behind it for the first time.

`repoStickinessMs` **is not changed here**. The sticky's error is exactly what the panel measures,
and to change the number in the same change as the mechanism makes the measurement unreadable.
Revisit it once the number is in.

## Privacy

No new exclusion rule, and `title-pattern` is not widened.

A rule is `{ kind: 'app-id' }` or `{ kind: 'title-pattern' }` (`libs/timetrack/src/lib/store/exclusion.ts:9`),
and a `title-pattern` tests `titleOf(event) ?? pathOf(event)` (`exclusion.ts:123-129`). A window
event always has a title, so a rule would never reach a working directory on it. Two fixes were
rejected:

- **Widen `title-pattern` to test the title and the path.** It silently broadens every rule already
  saved: a rule for a chat window starts excluding a checkout whose name it happens to match. That
  is the worst kind of change to a privacy control.
- **A new `path-prefix` rule kind.** It puts a second path system next to project links, and two
  controls that both take a checkout out of a day leave the user unsure which one is in force.

**What holds instead**, and it is stated plainly for the user: a checkout you want unseen needs a
**private project link** (`libs/timetrack/src/lib/model/project-link.ts:52-69`). An `app-id` rule
drops the whole event, the directory included. A path that is no discovered root is never stored.
No exclusion rule is a substitute for the link.

## Proof

| Layer                            | What it covers                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| `cargo test`                     | The process walk and the port lookup, against processes it spawns. |
| Vitest, `libs/timetrack`         | The title-to-port parse, and the `streamDay` precedence rule.      |
| Playwright, `apps/timetrack-e2e` | The Sources panel, over a seeded day.                              |

These are the crate's first real tests. The `cargo test` step was added before any test existed, so
the room is already there — see open question 1 of [`e2e-strategy.md`](./e2e-strategy.md).

**No automated test covers the whole chain.** A real process, a real compositor and a real dev
server cannot be replayed. The live day below is what covers it.

### The exit test

1. **A live day.** Work an ordinary day with the panel open. It passes if every window that held a
   checkout was named, and if you can explain every application still in the folded line.
2. **The three replayed days**, 2026-08-12, 08-17 and 08-18. They hold no working directory, so
   they must produce the **same** numbers as before the change. This is what proves nothing else
   moved.

A failure is fixed in the platform layer or in `streamDay`, never by an edit in the UI.

Rejected for now: a Playwright test that spawns a real listener and asserts the named stream. It
needs `tauri-driver` and the built host, which the suite does not drive — deferred by open question
2 of [`e2e-strategy.md`](./e2e-strategy.md).

## Left open on purpose

- **A shell hook over the ingest seam.** It is the fallback for a compositor with no socket, and
  for a `cd` inside a window that keeps focus. The seam is ready: the record is an open bag with
  `atMs` and `kind` as the only interpreted fields
  (`libs/timetrack/src/lib/ingest/model.ts:41-45`), so a new kind costs a parser branch and no host
  change. A reporter must read the `0600` discovery file at each post, because the token is new at
  every app start (`src-tauri/src/ingest.rs:227-231,397-420`).
- **The guessed rung**: an agent session holds a terminal's checkout sticky. Only for a platform
  that can never read a process.

## What this plan does not decide

- **The order of the rungs.** Step 0's number decides it. Nothing beyond step 0 starts before that
  number exists.
- **`repoStickinessMs`.** Revisited with the number in hand, and never in the same change.
- **Whether a browser reporter is ever needed.** Rung 2 answers the dev-server case, which is the
  only case measured so far.
