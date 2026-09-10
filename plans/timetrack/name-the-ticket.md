# Name the ticket

Slice 2, milestone M2 of [`roadmap.md`](./roadmap.md). Grilled with Tom on 2026-09-10 against four
of his real tickets. It replaces the "Slice 2: Name it, in outline" section of
[`vertical-slices.md`](./vertical-slices.md), which said a per-repo rule and naming by hand and
nothing else. That outline is not wrong. It is a third of the feature.

## What the real tickets say

Read through the running app, on 2026-09-10:

| Key          | Type | Parent       | Summary                                                       |
| ------------ | ---- | ------------ | ------------------------------------------------------------- |
| FIFAGG-12605 | Epic | none         | Finals 2026: Bracket Challenge                                |
| FIFAGG-12623 | Task | FIFAGG-12605 | Spezifizierung Bracket Challenge im FE                        |
| FIFAGG-12624 | Task | FIFAGG-12605 | Umsetzung Bracket Challenge für Groups und Single Elimination |
| BD-2049      | Task | none         | Intern: Meeting 2025                                          |

And in the working copies, for the same work:

| Checkout                 | Branch                               | Books to     |
| ------------------------ | ------------------------------------ | ------------ |
| `fifagg/specs`           | `spec/20260819_bracket-challenge`    | FIFAGG-12623 |
| `fifagg/fifagg-frontend` | `feature/20260819_bracket-challenge` | FIFAGG-12624 |

Neither branch carries a key, so `parseBranch` names nothing and rungs 2, 3 and 4 of the built
ladder all miss. The slug is identical in both, after a different type prefix.

## Three findings, and each one changes a rung

### 1. Most of the day books to a standing ticket

`ET-772` takes every hour in `ethlete-sdk`. `BD-2049` takes every internal meeting, and Tom
confirmed there are several such tickets. Only the bracket challenge had tickets for the work
itself.

So the load-bearing rung is one standing answer per context, and there are three kinds of context:
a repository, a meeting group, and a work item. A `repo` rule covers the first today. Nothing
covers the other two.

**The trap, and it is live.** `BD-2049` is named "Intern: Meeting 2025" and it is still the current
one. A rule is a standing answer with no end, so a rule that names a ticket which was retired in
January keeps booking to it in December and nothing says so. A standing rule needs an expiry, or a
notice when the ticket it names stopped being touched.

### 2. The branch slug names the epic, not the issue

This was the grill's one reversal. A slug rule pointing at an issue would have booked the
specification hours to the implementation ticket. What `20260819_bracket-challenge` identifies is
FIFAGG-12605.

The structure is three layers, and each has a different key:

| Layer    | Keyed by                       |
| -------- | ------------------------------ |
| The epic | the branch slug, across repos  |
| The task | the epic **plus** the checkout |
| The row  | the stream                     |

Two consequences:

- **The cut between two tickets is the checkout.** Tom could not say where 12623 ends and 12624
  begins, and he never has to: the specification repository is one and the frontend is the other.
  ADR 0001 already keys a stream by the checkout, so this needs no way to split a stream — which
  retires the question `vertical-slices.md` left open under slice 1.
- **This is what answers "which epic" and "when to create".** The epic is the parent of the sibling
  task that another checkout of the same slug books to. A ticket is worth creating when the epic is
  known and no child of it belongs to this checkout, and the summary drafts from the branch subject
  plus the repository's role. With no sibling the app knows nothing, and it asks.

### 3. The microphone is the fact; the calendar is a candidate list

Tom holds overlapping invitations and attends one of them. Today `matchMeetings` makes a row out of
every accepted occurrence, so all three would become rows and two would be false.

The order inverts. `CallWindow` already carries the interval, the process and the window title that
was in front of it:

1. The microphone says a call ran, from when to when, held by which application.
2. The calendar offers every occurrence that overlaps that window.
3. One is picked, in this order:
   - the conference id in a window title during the call — `conferenceIdOf` and `titlesDuring` are
     built, and this is decisive, so `certain`;
   - the application rules candidates out, because a Discord call is no Meet occurrence;
   - one candidate is left and it was accepted — `likely`;
   - nothing decides, and the row is unnamed with the candidates listed to pick from.
4. **An accepted occurrence with no call observed proposes nothing.** It becomes a question, never a
   row. That holds the no-silent-fill promise, and it is also the honest answer for a meeting held
   in a room or on a phone.

Tom's three meetings split exactly along the mechanism:

| Meeting                     | In the calendar? | What names it                                   |
| --------------------------- | ---------------- | ----------------------------------------------- |
| Monday 09:15, Meet, BD-2049 | Yes, every week  | The series, named once. Always the same ticket. |
| Monday 09:30, Discord       | **No**           | A rule on the application and the weekday slot. |
| Wednesday 09:15, fifagg     | **No**           | The same rule.                                  |

So the series id is the key for one half and cannot help the other. The fifagg calls exist nowhere
but on the microphone, and a rule the user writes once is the only thing that can ever name them.

## What the model is missing

- **`recurringEventId` on the occurrence.** `CalendarOccurrenceEvent` carries `occurrenceId`,
  `until`, `title`, `accepted` and `conferenceUrl`. Without the series id, naming a weekly meeting
  once is impossible, and the Tempo-history rung needs three weeks before it says anything — so it
  can never bootstrap.
- **A meeting-group rule.** `MeetingOptions.defaultIssueKey` is one global key. Tom has several
  standing meeting tickets, so the rule has to name a group and the group has to name the ticket.
- **A rule scope for a call.** `AttributionScope` is `branch | repo | app`. A call rule needs the
  application **and** a weekday slot, because Discord carries more than one client's calls.
- **An epic rung.** Nothing in `attribute.ts` reads a slug, an epic, or a sibling task.

Deliberately **not** added: the other attendees of an invitation. A domain in an invitation would
name the client cheaply, and it is the most privacy-sensitive field on the roadmap. It needs its own
ADR and it is not in this slice.

## Exit test

A real day, judged by Tom in writing, in this order:

1. Before the screen is opened, he writes down which issue each piece of that day belongs to.
2. The screen is opened.
3. The day passes if every stream carries that issue, or states in words why it cannot name one.

It stays read-only. A wrong answer costs a correction, never a worklog. That is why this slice runs
before booking rather than with it.

## Left to decide before it is built

1. **What tells one meeting group from another when both are calls.** Monday 09:15 is Meet and
   09:30 is Discord, so the application would work today and break the first time a fifagg call runs
   on Meet.
2. **Whether the fifagg meetings go into the calendar.** This is a question about Tom's habits, not
   about code, and it decides how much the application rule has to carry. If those calls get
   calendar entries, the series mechanism names all three meetings and the application rule becomes
   a fallback. If they never do, the application rule is the primary mechanism for two of the three.
3. **Whether a standing rule expires, or only warns.** See the `BD-2049` trap above.
4. **Whether the epic rung reads the slug or the sibling.** The slug is a string operation with no
   lookup. The sibling needs the other checkout's own answer, which exists only after that checkout
   was named once.
5. **What a stream shows when two rungs disagree.** The ladder returns the first hit today, and this
   slice adds rungs above and below the existing ones.

## Not in this slice

No booking, no ticket creation from a button, no reasoning provider. Creation is designed here only
far enough to say **when** it should be offered and **which epic** it would use. The build of it
belongs with M5, beside the write that can double-book.
