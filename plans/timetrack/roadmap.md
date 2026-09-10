# The roadmap

Agreed with Tom on 2026-09-10. It answers one question: in which order does the rest of the app
get built, and what ends each step.

It holds no design. Each milestone below names the slices it holds, the test that ends it, and
what has to be decided before that slice can be planned. A slice is then planned end to end with
the `ethlete-grill-with-docs` skill, and gets its own plan in this directory.

## Which plan wins

This plan owns **the order**. It replaces the slice table in
[`vertical-slices.md`](./vertical-slices.md), and that plan stays right about everything else:
where v2 lives, what slice 1 does, the rules that carry over, and the no-git-flow decision.

A per-slice plan owns **the detail** of its own slice. Where it disagrees with this plan about
detail, it wins. Where it disagrees about order, this plan wins.

## A slice number is a name, not a position

Slices 1 to 6 keep the numbers `vertical-slices.md` gave them. Other plans and four ADRs already
name those numbers, and a renumber would make every one of them wrong. New work gets slice 7 and
up, whatever position the roadmap gives it.

## Where the work stands, on 2026-09-10

| Part                                                | State                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Rust host, keychain, encrypted store, tray, widget  | Built. Proven on Linux and macOS.                                     |
| Collectors: window, idle, git, agent sessions, call | Built. Being hardened now.                                            |
| Providers: Jira, Tempo, GitLab, GitHub, Google      | Built, and verified against the real instances.                       |
| `streamDay` and the Today screen                    | Built. Slice 1 is on screen.                                          |
| Naming the unnamed window                           | Two rungs built. The rest waits on five more workdays of measurement. |
| Slices 2 to 6                                       | One paragraph of outline each.                                        |
| A production Tempo worklog                          | **Never written.** No day has left this machine.                      |
| A day that spans two machines                       | **Not built.** Each machine reports only what it saw.                 |
| Autostart, an updater, a packaged build             | Not built. `tauri:build` runs by hand.                                |
| `correlate/` and the v1 screens                     | Alive. ADR 0007 says they are replaced, not repaired.                 |

## The six answers this plan is built on

Tom decided all six on 2026-09-10:

1. **The audience is Tom first, then the Braune Digital team.** So a milestone exists for the
   install, and it comes after booking works.
2. **The current phase ends when no worklog is typed by hand.** So slices 2 and 3 are the next
   feature work.
3. **The cost side is a first-class goal, not a report that rides along.** So it gets two
   milestones and its own hardening slice.
4. **Reliability is its own milestone, and an early one.** A day the app did not watch is a day
   nobody can book, so it comes before booking.
5. **Naming a stream comes before everything except trusting the screen.** It is read-only, and it
   is the step the vertical slice asks for next.
6. **A day spans every machine the user owns, and it syncs over the LAN.** The whole day merges,
   not presence alone, for any number of the user's own machines. It comes before booking, for the
   same reason as answer 4.

## The milestones

| #   | Name                            | Slices | Ends when                                                            |
| --- | ------------------------------- | ------ | -------------------------------------------------------------------- |
| M1  | The day it shows is true        | 1      | Three replayed real days read as true, with no edit.                 |
| M2  | Name it                         | 2      | Every stream of a real day carries the right issue, or says why not. |
| M3  | No day is lost                  | 7      | A reboot, a crash and two hours off all reconcile on the screen.     |
| M4  | One day, every machine          | 8      | A day worked on two machines reads the same on both, once.           |
| M5  | Book it                         | 3      | One real week reaches Tempo, and the second sync writes nothing.     |
| M6  | The whole day                   | 4      | A day with meetings, a timer and a pause needs no hand-typed row.    |
| M7  | What a day cost                 | 5, 9   | A real day shows a cost Tom recognises, and names what it missed.    |
| M8  | The week, and the price of work | 6, 10  | Time and cost per issue and per project, over a week.                |
| M9  | A second person installs it     | 11     | A colleague books a day from a build, with no help from this repo.   |
| M10 | The noisy tail                  | 12     | Gmail, Codex logs and the browser reporter.                          |

## M1: The day it shows is true

**In flight.** Another agent works on it now.

The screen exists. What is not finished is the collection under it: the unnamed window, the
liveness of each source, and the call source outside macOS.

Exit test: the slice 1 test in `vertical-slices.md`, over 2026-08-12, 2026-08-17 and 2026-08-18,
plus the exit test in [`name-the-window.md`](./name-the-window.md).

Decided before the next rung is built: which mechanism names a browser tab, and whether a title
rule is one of them. That plan holds the reading it waits for. Do not pick a rung before it.

## M2: Name it

**Slice 2.** Moved ahead of slices 7 and 8 on 2026-09-10, at Tom's request: mapping a stream to an
issue is the next step the vertical slice asks for, and it is read-only, so it can precede both the
reliability work and the sync.

It is planned in [`name-the-ticket.md`](./name-the-ticket.md), which measured four of Tom's real
tickets and grew the slice well past the "a per-repo rule, then naming by hand" outline in
`vertical-slices.md`. Three findings drive it:

1. **Most of the day books to a standing ticket**, not to a ticket for the work. ET-772 for the SDK,
   BD-2049 for internal meetings.
2. **A work item spans repositories, and the epic is what it shares.** The branch slug names the
   epic; the epic plus the checkout names the task.
3. **The microphone is the fact and the calendar is a candidate list**, because Tom holds
   overlapping invitations and attends one.

Exit test: every stream of a real day carries the right issue, or states why it cannot. It stays
read-only, so a wrong answer costs a correction and never a worklog.

## M3: No day is lost

**Slice 7. New, and it is a slice of its own.**

The app now starts because Tom starts it. Every hour it is not running is an hour no screen can
show and no pipeline can rebuild, and the app does not say which hours those were.

What the slice holds:

- Autostart on login, and a start into the tray with no window.
- A restart after a crash, and a day that spans a reboot.
- A stretch the app did not watch, stated on the Today screen as such.
- The rebuilt-time path of ADR 0006, proven from end to end rather than from one measurement.

Exit test: three interruptions on one real day. Reboot in the middle of it. Kill the process.
Quit the app for two hours. The Today screen reconciles all three, and it names each stretch it
did not watch.

To decide before this is planned:

- Is autostart on by default, or offered on first run?
- Does the tray say the app is collecting, or only that it runs?
- What does a day hold for the time before the first login of the morning?

Held back on purpose: the updater. It belongs to M9, because it only matters once somebody else
holds a build.

## M4: One day, every machine

**Slice 8. New.** It is the largest slice on this roadmap, and it is the one with the heaviest
consequences. Raised on 2026-09-09, scoped on 2026-09-10.

Tom works on a second machine during meetings. This machine then reports those hours as
unattended, because only its own collectors saw the day. ADR 0006's rebuilt time cannot help: a
machine that observed nothing has no keystrokes and no commits to read back.

So the day is wrong before anything books it, and the hours it loses are exactly the ones a
hand-typed row would cover. That is why this comes before M5 and not after it.

### The scope Tom set

- **The whole day merges**, not presence alone. Events, streams and spend.
- **Any number of the user's own machines.** Discovery and pairing for N devices, not a fixed pair.
- **No colleague's machine, ever.** That would cross the ruling against any view over other
  people's time, and this slice does not touch that ruling.

### The privacy ruling this changes

`plans/timetrack.md` locks "strictly local, the data never leaves the machine" and lists
cross-device sync as out of the plan. That sentence now has to become two:

- **No hosted backend, no cloud, no third party.** Unchanged, and this slice adds none.
- **A machine of the same person, paired by hand, on the same network, is in.**

This is the hardest-to-reverse privacy decision in the app, so it needs its own ADR before a line
is written. A window title, a prompt and a checkout name all leave one machine under it.

### What the slice holds

- Discovery on the local network, and pairing by hand. No port anything can simply join.
- A per-pair secret, held in each machine's keychain, and an encrypted transport.
- The merge: presence unions with every overlap counted once, engaged time sums per stream, and
  spend stays with the machine that spent it.
- Exactly one machine books a day.
- A machine that is off, said out loud. An incomplete day reads as incomplete rather than as a
  short one.

### The store change under it

`collected_event.id` is a local `AUTOINCREMENT` integer, so an event has no identity two machines
can agree on. A merge therefore needs an origin and a stable id per event, which is a schema
migration past version 13. `db.rs` states the rule: never edit a migration that has run, add the
next one. This is the part that cannot be undone once real days hold it.

### Exit test

One real workday, worked on both machines, with a meeting on the second one.

1. Both machines show the same presence, the same engaged time and the same spend.
2. Neither counts one hour twice, and the concurrency on both reads the same.
3. One machine books the day. The other says it is booked, and refuses to book it again.
4. The second machine is then switched off for an hour. Both screens say the day is incomplete,
   and they name the machine that is missing.

### To decide before it is planned

- **Which machine owns a day.** A fixed one, or the one the user books from.
- **Clock skew.** Presence is wall-clock time, so two machines that disagree by a minute either
  double-count an overlap or drop one. Name the tolerance, and what happens past it.
- **The stream key across machines.** `CONTEXT.md` keys a stream by the checkout. Two machines
  with a checkout of the same name are then one stream or two, and the answer changes every total.
- **Whether the merge is continuous or on demand**, and what a machine does with a day that
  changed after it already merged it.
- **What a paired machine needs.** Only collectors, or the whole Jira, Tempo and Google stack.
- **Retention and redaction over what arrives.** A title from the other machine must obey the same
  redaction rules and the same private-project link as a title collected here.

## M5: Book it

**Slice 3.** This is the milestone the current phase ends on: no worklog typed by hand.

M2 named the day. This slice books it. Tempo sync for accepted rows only, one day at a time, through the `tempo/`
module that is already built and already idempotent. It deletes `day-review/`.

Exit test: one real week reaches Tempo through the app. Tom types no worklog by hand for code
work in that week. Every day syncs twice, and the second sync writes nothing new.

To decide before slice 3 is planned:

- **The ownership marker.** Open question 4 of `plans/timetrack.md` leaves `description-suffix`
  and `none` both built and neither picked. A worklog with no marker is foreign for good once the
  local ledger is lost. Pick it before the first production write.
- **The working-hours policy.** Open question 5 is still open. Is work at 23:00 proposed at all?
- **The undo.** A wrong row that reached Tempo needs a way back out, and the ledger is the only
  record of what the app wrote.
- **The first production write is a one-way step.** It gets its own gate: one day, one issue, one
  hour, checked in the Tempo UI by hand before a week is ever synced.

**A tension this milestone does not remove.** Meetings arrive in M6, not here. So a booked day may
still miss a meeting, and Tom still types that row by hand. The milestone's name is true for code
work. It is not yet true for the whole day.

## M6: The whole day

**Slice 4.** Meetings, timers and pauses appear as themselves, not as gaps.

The parts already exist: the call source collects the process that holds the microphone, the
Google Calendar provider reads the day, the timer runs, and the hard pause is built. What is
missing is their place in `streamDay` and on the Today screen.

Exit test: a real day with two meetings, one explicit timer and one pause books with no hand-typed
row at all.

To decide: whether a meeting is presence when the machine is idle, and how a meeting that overlaps
a coding stream is counted. Slice 1 gates everything on presence, so a meeting away from the
keyboard books nothing today. That rule has to change here, and it is the change that can inflate
a day.

## M7: What a day cost

**Slice 5, plus slice 9.**

Slice 5 is the price table: a token count becomes money, per model and per day.

Slice 9 is new, and it is the hardening the cost goal needs. Spend that no stream can hold is the
cost side's version of the unnamed window. It has to be measured, then either attributed or
reported as unattributed. `CONTEXT.md` already reserves the word.

Exit test: a real day shows a cost Tom recognises, and it states the share of spend no stream
took, rather than folding it into a line.

To decide: where a price lives when it changes. A day in June and a day in September use different
prices for the same model, so a price is dated, and a re-read of an old day must not reprice it.

## M8: The week, and the price of work

**Slice 6, plus slice 10.**

Slice 6 is the week: time and cost per issue and per project, over seven days. It is the slice
that takes the week view and the tray readout off `correlate`, and it lets `correlate/` be
deleted.

Slice 10 is the product goal behind the cost side: what one piece of work cost. Cost per issue
against its estimate, and a total per project per month.

Exit test: a week that shows both numbers per issue and per project, and a `correlate/` directory
that is gone.

**The open product question, and it is the sharpest one on this roadmap.** The number a company
wants is what issue FIP-2929 cost, over everybody who touched it. M4 makes a day whole across the
user's **own** machines, and it changes nothing here: `plans/timetrack.md` still rules out any
aggregate view over other people's time and any hosted backend. So the cost of an issue is one
person's cost of it. If the first-class cost goal means the company-wide number, that ruling has
to be revisited, and it is a decision about the whole product rather than about a slice. Answer it
before M8 is planned.

## M9: A second person installs it

**Slice 11.** It is one milestone with several parts, and it may split when it is planned.

- A packaged and signed build, per operating system, from CI rather than from this checkout.
- An updater, and what an update does to a day that is being collected.
- First run: the keychain, the database, and the autostart choice from M3.
- Per-user setup for Jira, Tempo and Google. Each user registers their own OAuth clients, and the
  README's Google walkthrough is not a setup screen.
- A Windows collector. Focus and idle both have plain Win32 answers.
- The reporter install wizard, at least its detect-and-report half.

Exit test: one colleague installs a build on their own machine, connects their own Jira, Tempo and
Calendar, and books a day. They use no file from this checkout, and they ask no question this
roadmap did not expect.

To decide: which operating systems the first team build covers, and who pays for an Apple
Developer identity if macOS is one of them. Also, what pairing means here: a colleague's machine
never pairs with Tom's, and the install must make that impossible rather than merely unlikely.

## M10: The noisy tail

**Slice 12.** Phase 3 of `plans/timetrack.md`, unchanged: Gmail notification parsing, Codex
session logs, and the browser reporter over the ingest seam.

Every entry here is a source, and every source is cheap once the pipeline is trusted. That is why
they sit last. None of them is a reason to distrust a number, and none of them blocks a booking.

## What runs beside every milestone

Not milestones. They are part of each slice, in the way the changeset is:

- **The proof.** [`e2e-strategy.md`](./e2e-strategy.md) holds the fake backend, the seed and the
  clock. Each slice extends it. What stays manual is named there.
- **Privacy.** A new field that holds a title, a path or a prompt needs an entry in the retention
  and redaction rules, and it needs the private-project link to keep working.
- **The vocabulary and the records.** A new term goes in `libs/timetrack/CONTEXT.md`. A decision
  that is hard to reverse gets an ADR in `libs/timetrack/docs/adr/`.
- **The changeset.** `timetrack-app` is versioned like every published package.

## Not on this roadmap

From `plans/timetrack.md`: any manager or aggregate view over other people's time, a hosted
backend, a Jira Data Center provider, and a worklog target that is not Tempo.

**Cross-device sync has come off this list, and only in one shape.** M4 builds it for the user's
own machines, over the local network, paired by hand. A cloud, a relay and a third party stay out,
and so does any machine that is not the user's own.

One more entry, still deferred:

- **Auto-resume and auto-pause on standby.** It is in tension with the hard pause, which promises
  that nothing collects until the user says so. If both ever ship they are two controls, never one.
