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
| Slices 2a to 2c                                     | Planned. M2 needs its own document; M4 does too.                      |
| Slices 5, 6, 9 to 12                                | One paragraph of outline each.                                        |
| A production Tempo worklog                          | **Never written.** No day has left this machine.                      |
| A day that spans two machines                       | **Not built.** Each machine reports only what it saw.                 |
| Autostart, an updater, a packaged build             | Not built. `tauri:build` runs by hand.                                |
| `correlate/` and the v1 screens                     | Alive. ADR 0007 says they are replaced, not repaired.                 |

## The seven answers this plan is built on

Tom decided all seven on 2026-09-10:

1. **The audience is Tom first, then the Braune Digital team.** So a milestone exists for the
   install, and it comes after booking works.
2. **The current phase ends when no worklog is typed by hand.** So slices 2 and 3 are the next
   feature work.
3. **The cost side is a first-class goal, not a report that rides along.** So it gets two
   milestones and its own hardening slice.
4. **Reliability is its own milestone, and an early one.** A day the app did not watch is a day
   nobody can book, so it comes before booking.
5. **Drawing the day comes before naming it, and naming it comes before everything else.** A match
   with nothing to attach it to is not a product. So M2 draws, M3 names, and both precede booking.
6. **A day spans every machine the user owns, and it syncs over the LAN.** The whole day merges, not
   presence alone, for any number of the user's own machines. It sits **after** booking, unlike
   reliability: it is convenience across machines Tom owns, and a lost day is not.
7. **The basic app is the timeline, the match and the draft.** Everything else is nice to have. In
   Tom's words: "if the basic app doesnt work then the auto update wont help either." This answer
   outranks the other six wherever they disagree about order.

## The milestones

| #   | Name                            | Slices | Ends when                                                          |
| --- | ------------------------------- | ------ | ------------------------------------------------------------------ |
| M1  | The day it shows is true        | 1      | Three replayed real days read as true, with no edit.               |
| M2  | The day, drawn                  | 2a, 4  | Tom reads a real day on one screen, and cuts it where he wants.    |
| M3  | The day, named                  | 2b     | Every band of a real day carries the right issue, or says why not. |
| M4  | The day, ticketed               | 2c     | A real week: every gap drafts a ticket or produces a report.       |
| M5  | No day is lost                  | 7      | A reboot, a crash and two hours off all reconcile on the screen.   |
| M6  | Book it                         | 3      | One real week reaches Tempo, and the second sync writes nothing.   |
| M7  | One day, every machine          | 8      | A day worked on two machines reads the same on both, once.         |
| M8  | What a day cost                 | 5, 9   | A real day shows a cost Tom recognises, and names what it missed.  |
| M9  | The week, and the price of work | 6, 10  | Time and cost per issue and per project, over a week.              |
| M10 | A second person installs it     | 11     | A colleague books a day from a build, with no help from this repo. |
| M11 | The noisy tail                  | 12     | Gmail, Codex logs and the browser reporter.                        |

Reordered on 2026-09-10, after Tom described the product he wants. His words: "thats where you come
in and thats why we should prioritize this part now since everthing else is nice to have. if the
basic app doesnt work then the auto update wont help either." So the block he called the basic app
— a timeline, a match, a draft — becomes M2, M3 and M4, and everything else moves down behind it.

Old M6 ("the whole day": meetings, timers and pauses appear as themselves) is dissolved. A timeline
that hides a meeting is not the timeline he asked for, so that work sits inside M2 and M3.

## M1: The day it shows is true

**In flight.** Another agent works on it now.

The screen exists. What is not finished is the collection under it: the unnamed window, the
liveness of each source, and the call source outside macOS.

Exit test: the slice 1 test in `vertical-slices.md`, over 2026-08-12, 2026-08-17 and 2026-08-18,
plus the exit test in [`name-the-window.md`](./name-the-window.md).

Decided before the next rung is built: which mechanism names a browser tab, and whether a title
rule is one of them. That plan holds the reading it waits for. Do not pick a rung before it.

## M2: The day, drawn

**Slices 2a and 4.** The screen Tom described: "a clear timeline of what i did and when i did it".

Today shows streams in an accordion with no time axis. Day Review draws a real 24-hour axis beside a
table of bookable rows. Two screens mean he reads the same day twice in two shapes, so they merge.
ADR 0011 records the decision and its cost.

What the milestone holds:

- One day screen. `DayTimelineComponent` moves onto it; it already draws a proportional axis on top
  of `SchedulerTimeGridDirective` from `libs/components`.
- **A band is a row, not a stream.** A row splits, merges and moves its boundary already. A stream is
  keyed by its checkout under ADR 0001 and cannot be cut. The stream becomes the evidence behind a
  band, shown when the band is opened.
- Split and glue, which Tom asked for by name. `splitRow`, `mergeRows` and `moveRowBoundary` exist.
- `PinnedRow.issueKey` becomes optional, so a fresh cut can stand with neither half named.
- Meetings, timers and pauses appear as themselves rather than as gaps. This is the old slice 4: the
  call source, the calendar provider, the timer and the hard pause are all built, and what is
  missing is their place in `streamDay` and on the screen.
- Two windows of the same application separated by a short gap are one call. Every Google Meet opens
  the microphone twice, because its pre-join screen runs a device check. Measured on 2026-09-10.

It writes local edits to `day_review` and never reaches Tempo.

Exit test: Tom reads a real day on one screen, and cuts it where he wants it cut.

To decide before it is planned, both carried over from the dissolved slice 4:

- Is a meeting presence when the machine is idle? Slice 1 gates everything on presence, so a meeting
  away from the keyboard books nothing today. That rule has to change here.
- How is a meeting that overlaps a coding stream counted? This is the change that can inflate a day.

## M3: The day, named

**Slice 2b.** Planned in [`name-the-ticket.md`](./name-the-ticket.md), grilled with Tom over five
rounds on 2026-09-10 against four of his real tickets and one live meeting.

Three decisions carry it, and each has an ADR:

1. **The branch slug names the epic, not the issue** (ADR 0009). The epic plus the checkout names the
   task, and the checkout is what cuts one task from its sibling.
2. **A call is the fact and the calendar is a candidate list** (ADR 0010). An accepted occurrence
   with no call observed proposes nothing.
3. **A remembered naming outranks a branch parse** (ADR 0012). One learned store at rung 2, seeded
   from Tempo history, written by a naming of Tom's, never written by a model.

When two rungs disagree, the band shows both and asks.

Exit test: every band of a real day carries the right issue, or states in words why it cannot name
one. Tom writes the answers down before the screen is opened, and judges it in writing.

## M4: The day, ticketed

**Slice 2c.** What happens where the ladder found nothing.

- A drafted ticket: a title, a body, and the epic it goes under, shown with the reason that epic was
  chosen. It is created only on a press. `writeTicketWithAgent$` already drafts wording.
- With no fitting epic, a report for the project manager, who owns epics. It is the gap plus a draft
  epic, as text Tom copies. The app never writes an epic itself.
- The model call, on a press, with the full prompt shown first and the answer stored so the same
  question never costs twice. This changes the path that exists: `reasoning.enabled` is a setting
  today, and once it is on the call runs during day review with no press and no preview.
- The anonymiser (ADR 0013). Names inside free text become pseudonyms derived from the name list, and
  no map is stored. A Jira project key prefix is a project name, so it is pseudonymised too.
- The app meters its own model spend, on its own line, never charged to the band it asked about.

The model's jobs, in order: draft a ticket, write a description, propose a pattern Tom accepts. It
never names a band the ladder could not, and it never writes to the naming store.

Exit test: one real week where every gap either drafts a ticket Tom is willing to create, or produces
a report he is willing to send.

To decide before it is planned:

- Whether the report stays as copied text once the project manager says what they want.
- Whether the name list is seeded from Jira and the address book, or built by hand as words appear.
- Whether the CLI reports its token use in print mode. If it does not, the app records the call count
  and the model instead.

## M5: No day is lost

**Slice 7. New, and it is a slice of its own.**

The app now starts because Tom starts it. Every hour it is not running is an hour no screen can
show and no pipeline can rebuild, and the app does not say which hours those were.

What the slice holds:

- Autostart on login, and a start into the tray with no window.
- A restart after a crash, and a day that spans a reboot.
- A stretch the app did not watch, stated on the day screen as such.
- The rebuilt-time path of ADR 0006, proven from end to end rather than from one measurement.

Exit test: three interruptions on one real day. Reboot in the middle of it. Kill the process.
Quit the app for two hours. The day screen reconciles all three, and it names each stretch it
did not watch.

To decide before this is planned:

- Is autostart on by default, or offered on first run?
- Does the tray say the app is collecting, or only that it runs?
- What does a day hold for the time before the first login of the morning?

Held back on purpose: the updater. It belongs to M10, because it only matters once somebody else
holds a build.

## M6: Book it

**Slice 3.** This is the milestone the current phase ends on: no worklog typed by hand.

M3 named the day, and M4 filled its gaps with tickets. This slice books it. Tempo sync for accepted rows only, one day at a time, through the `tempo/`
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

**A tension this milestone used to carry, and no longer does.** Meetings arrived in the old M6,
after booking, so a booked day still missed a meeting. Under the new order they arrive in M2 and are
named in M3, both ahead of this. The milestone's name is now true for the whole day, not only for
code work.

## M7: One day, every machine

**Slice 8. New.** It is the largest slice on this roadmap, and it is the one with the heaviest
consequences. Raised on 2026-09-09, scoped on 2026-09-10.

Tom works on a second machine during meetings. This machine then reports those hours as
unattended, because only its own collectors saw the day. ADR 0006's rebuilt time cannot help: a
machine that observed nothing has no keystrokes and no commits to read back.

So the day is wrong before anything books it, and the hours it loses are exactly the ones a
hand-typed row would cover.

**It moved below booking on 2026-09-10.** On 2026-09-09 it sat ahead of M6 for that reason. Tom
then named the timeline, the match and the draft as the product, and everything else as nice to
have. Sync across his own machines is that: convenience across machines he owns, not a step
booking cannot happen without. Reliability keeps its place ahead of booking, because a lost day
makes a wrong worklog and a worklog is the one act that cannot be taken back. The cost of the move
is stated plainly: until this ships, a day worked on a second machine books short, and Tom types
that row by hand.

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

## M8: What a day cost

**Slice 5, plus slice 9.**

Slice 5 is the price table: a token count becomes money, per model and per day.

Slice 9 is new, and it is the hardening the cost goal needs. Spend that no stream can hold is the
cost side's version of the unnamed window. It has to be measured, then either attributed or
reported as unattributed. `CONTEXT.md` already reserves the word.

Exit test: a real day shows a cost Tom recognises, and it states the share of spend no stream
took, rather than folding it into a line.

To decide: where a price lives when it changes. A day in June and a day in September use different
prices for the same model, so a price is dated, and a re-read of an old day must not reprice it.

## M9: The week, and the price of work

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

## M10: A second person installs it

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

## M11: The noisy tail

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
