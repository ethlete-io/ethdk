# Ticket the day

Milestone M4 of [`roadmap.md`](./roadmap.md), slice 2c. Grilled with Tom on 2026-09-14, in seven
rounds, against one live case. It is the plan the roadmap says M4 needs, and it changes one sentence
M4 holds today: "the app never writes an epic itself".

M3 names what the ladder can name. This slice answers the rest, and the answer is not a ticket. It is
a name you give the work before Jira holds one.

## The case

Tom started a feature in `fifagg` called Competition Journey on 2026-09-14. No epic exists for it and
no ticket exists under one. The ladder finds two facts and then stops:

| What it finds          | Where                                            |
| ---------------------- | ------------------------------------------------ |
| The project `FIFAGG`   | `projectKeyFor`, `model/project-link.ts:72`      |
| The slug of the branch | `parseBranch`, and ADR 0009 reads it as the epic |

No sibling checkout names a key, so ADR 0009's epic rung asks. The branch carries no key, so rung 1
misses. Nothing else matches. The band is unnamed, and it will be unnamed again tomorrow.

**The gap is not the draft. The gap is the wait.** M4 as written answers a gap with a drafted ticket
or a report to the project manager. A report goes to another person, and that person answers next
week. Meanwhile the work continues, and the same question is asked on every day of it. Nothing in the
model can hold a name that Jira does not hold yet.

The case is a test case, not a specification. No project key, no branch slug and no feature name from
this document may appear anywhere in `libs/timetrack`. This is the rule ADR 0009 already states, and
the rule the SDK holds for theme names.

## The stand-in

A **stand-in** is a name for work that Jira does not hold yet. It takes bands the way an issue key
does, across days and across checkouts. It books nothing. When the issue appears, the stand-in is
resolved once, and every band it holds takes the key.

That is two acts, and the first is one press:

1. While you work: **no ticket yet**. The app opens a stand-in, pre-filled from the branch slug.
2. When the issue exists: **resolve**. Every band, on every day, follows.

Everything between the two is automatic. See ADR 0021.

### It is not a new kind of row

`UnnamedProposal` (`rows/propose.ts:15`) already exists. An unnamed band is drawn, split, merged and
moved, it carries a description, and ADR 0011 made it a legal state on purpose. A stand-in is a name
on the row that is already there.

**The band must not carry it in `issueKey`.** `isNamedRow` (`review/model.ts:73`) is a bare
`!!row.issueKey`, and six paths funnel through it: the Tempo preview (`sync.ts:78`), rounding
(`review-day.ts:94`), `checkDay`, the nudge, the tray readout and `defaultState`. A stand-in id in
that field would pass every one of them and read as bookable time. Nothing would stop it, because no
code anywhere checks that an issue key is shaped like one.

So the band carries `standInId`, beside an absent `issueKey`, and inherits "shown, counted undecided,
never written" for free.

### One stand-in, many matches

The identity is an opaque id. A stand-in does not hold its slugs. The **rules** hold them, one per
context it has met, and they point at it.

`AttributionRule` (`model/attribution.ts:25`) is already `{ id, repoPath?, branch?, appId?, target,
createdAt }`, with `matchAttributionRule`, `scopeOf` and `SCOPE_RANK` written. Its target gains a
third kind: `{ kind: 'stand-in'; standInId }`. Matching, scope ranking and storage then come free,
and **resolving is one rewrite** — every rule pointing at the stand-in takes
`{ kind: 'issue'; issueKey }` instead.

A rename of the branch therefore costs one press, once, and never a second stand-in. Naming a band to
an existing stand-in adds that band's rule to the set.

### Where it sits on the ladder

A stand-in rule is an attribution rule, so it sits where one sits: rung 2, branch-scoped
(`rows/attribute.ts:243`). It beats an MR match, a Tempo pattern, a key in a window title and a model
inference. It loses to rung 1.

That is the rule that ends it cleanly. On the day you cut a branch that names the real key, rung 1
wins, and the stand-in steps aside without being told.

### Calls get the same

A call is named on a different path — `rows/calls.ts:100` and `:180`, keyed on the meeting series or
on `CallFeatures`, never on a repo or a branch. So `CallNaming` gains the same stand-in target.

Without it, a weekly call with no ticket asks the same question every week, which is the failure
`name-the-ticket.md` already refused for meetings.

### Where it is stored

The settings document, beside `projectLinks` and `attributionRules`. `settings/model.ts:265` states
the criterion and this fits it: a handful of records the user wrote, read and written whole.

**No Rust migration.** `set_app_settings` takes a `serde_json::Value` and stores it verbatim, and
`parseTimetrackSettings` is total — a record it cannot read falls back rather than throws.

The record holds: the id, the name, the project key (optional), the state, the resolved issue key, the
day list, the author and `createdAt`.

## The epic

**The app files an epic.** M4 said it never would, because the project manager owns them. Tom's
project manager handed epics over for this project, and that is a per-project fact. See ADR 0022.

### Jira says whether you may, and you say whether you should

`/rest/api/3/issue/createmeta?projectKeys=<KEY>` returns the issue types **this user may create in
this project**, with their required fields. No epic type in the answer means no epic button. This is
the one new Jira call the slice needs, and it pays twice: it decides the button, and it names the
fields a create must carry.

`createmeta` reports what Jira permits, never what the team agreed. So the report to the project
manager is always present, never hidden by a permission.

### After the write, Jira owns the hierarchy

If the project manager moves a task under a different epic, the app follows. The band keys on the
task, so a moved parent changes no band and no worklog. The slug rung re-reads the parent from Jira
and never replays the epic the app created. There is no drift warning and no repair offer.

### What the epic says

Short. The summary is the stand-in name. The description is one or two sentences of intent.

The evidence stays in the child tasks. `draftTicket` (`ticket/draft.ts:99`) quotes commit subjects and
agent-session titles, which reads right in a task and wrong in an epic. A project manager opens an
epic to learn what the feature is.

The epic takes **no** branch-subject field. `JiraIssueInput.subjectField` feeds branch naming, and
nobody cuts a branch from an epic.

### A required field the app cannot fill

The app fills what `createmeta` names and it can answer. If a required field is left, it opens the
Jira create screen in the browser, with the summary and description pre-filled. You finish there.

**It learns, so the hand-off gets rarer.** `createmeta` names the required fields. The app then runs
one JQL over those field ids — `project = X AND issuetype = Y ORDER BY created DESC` — and takes the
value that dominates. `searchJiraIssues$` (`jira/search.ts:38`) already takes an explicit `fields`
list and returns each issue's fields, so this is a caller and not new client code.

One value on almost every recent issue is `likely` or better, and the app fills it. A spread of values
is `weak`, and it hands off. This learns before the first hand-off ever happens.

Where it was wrong, the correction is stored: after a hand-off the app reads the created issue back
and keeps the value you chose, per project, per issue type, per field, in the settings document.

## A create cannot be undone

Tom's Jira account cannot delete an issue. A ticket can always be moved and never removed, so a
duplicate is permanent and needs another person to hide it.

Nothing retries a create today — the Jira client has no retry, only an optional `timeoutMs`
(`transport/ports.ts:58`). That is not enough, because the dangerous case is a retry **you** make
after a lost response.

**The guard lives under `createJiraIssue$`** (`jira/create.ts:78`), not in the card. Four call sites
exist already, and one of them is the agent endpoint (`agent-endpoint.ts:177`), which another repo
reaches through the running app with nobody watching the screen.

Two parts, and they stop different failures:

- **An in-flight lock.** One create at a time per stand-in, and the button is disabled while it runs.
  This stops the double press.
- **A pre-flight search.** Before the write: this project, this exact summary, created by me, inside a
  short window. A match is shown and **nothing is created**. One more press uses the issue that is
  already there. This stops the lost response.

The match rule has to be tight on all four terms, or two issues you meant to file are both refused.

**The crash between two creates** is answered in order: write the created key onto the stand-in record
immediately after each create, before the next starts. Then re-check Jira for the epic by summary
whenever the card opens. The record is the fast path. Jira is the truth when the record is wrong.

## The card

One place holds the whole case. Its primary button changes with the state, and nothing else does.

1. **An epic is preselected.** Primary: **create the tickets**, one per checkout. The epic line shows
   why it matched and carries an escape.
2. **No epic is preselected.** Primary: **create the epic** when `createmeta` offers the type,
   otherwise **copy the report**. The other one stands beside it. Weak matches are listed under both.
   Close matches sit **above** the epic button, not below it, and the button states what it will file:
   project, issue type, summary.
3. **Done.** The card closes, and the bands carry their keys.

A stand-in may resolve to **any** issue. Resolve it to a task and it is finished. Resolve it to an
epic and the card moves to the task step, where ADR 0009 finishes the job: the epic plus the checkout
names the task.

**Preselection.** `certain` is a sibling checkout with the same slug already under that epic, which is
ADR 0009 and needs no wording match. `likely` is an epic summary that covers most of the slug words.
`weak` is a partial match, and it only appears in the list. `certain` and `likely` preselect. If two
epics both reach `likely`, neither is preselected and the card asks, which is the rule
`name-the-ticket.md` already holds for two rungs that disagree.

A preselect is a bind, and a bind creates nothing. That is why it may lean forward while the create
button may not.

**When the branch starts naming a real key**, the card proposes the resolve at `certain`: the branch
now names the issue, and the stand-in has done its job. This is the common ending, not an edge case.

**Where it lives.** The band opens it inline on the day screen. The day screen header holds one entry
to the list of open stand-ins, because "what is still unresolved" is not a question about a day.

**Ageing.** Two settings: an age in workdays, default 5, and a held time, default 4 hours. Past either,
the stand-in is marked in the list and the header shows a count. No notification. Nothing is blocked.
A stand-in is a debt to yourself, and the risk this design carries is one sitting until you have
forgotten what the work was.

## The day, while a stand-in is open

The day books its named rows now. It does not wait.

Under ADR 0020 a band counts as unattributed only if it is a checkout's work or a call, and
`under-target` only warns on a finished day. A stand-in band leaves the unattributed bucket as well:
unattributed means you still owe the app an answer, and on a stand-in band you do not. It is counted
as covered and not bookable.

The nudge (`nudge.ts:85`) splits rows into undecided and unsynced today. A stand-in band is neither,
so it gets a third word: **waiting**. Undecided means you owe the app an answer. Waiting means the app
owes you a ticket. The tray readout says how many.

The band shows the stand-in name rather than `'Not yet named'` (`row-appointment.ts:88`).

**After a resolve, the days it touched hold new bookable time.** The card names them from the day list
on the record, and each one links to that day screen. The sync stays exactly where M6 puts it. This
slice opens no second door to Tempo.

The day list is stored rather than recomputed, because `collected_event` is pruned by retention. A
stand-in open past that window cannot be replayed, and those are the days that waited longest.

## Undo, and delete

- **A resolve can be undone** while no day it touched has synced. Once a day has reached Tempo the
  undo is gone, and a wrong key is a correction like any other.
- **Deleting a stand-in** puts its bands back to unnamed on every day, and takes its rules with it.
  It is the resolve with no key at the end of it.

## The agent

One call drafts the epic and every task together. The model has to see the whole stand-in to write an
epic that is not the first task restated, and the tasks must not repeat each other. One prompt, one
preview, one press, one stored answer.

With no agent — `reasoning.enabled` off, or no CLI — `draftTicket` stands. `writeTicketWithAgent$`
(`ticket/write.ts:166`) already answers `null` rather than throwing. The card never needs the agent.

**What goes out is masked. What comes back is not.** ADR 0013 wrote the outbound half only. The return
path is new, and it is ADR 0023.

**The agent endpoint may list stand-ins and write none.** Other repos reach Jira through the running
app already. A list costs one op and lets an agent say "two stand-ins are open, one is five days old".
Opening one from the agent would put a name on the day that the user did not choose.

That is the start, not the end. The vision Tom stated on 2026-09-14 is that the agent eventually does
all of this: "open timetrack, let it running in the background, at the end of day review, maybe
correct some parts and sync to tempo". Two decisions in this slice exist to make that step small
rather than a rewrite:

- **Every stand-in and every rule carries `author: 'user' | 'agent'`.** The review shows an
  agent-written one differently. At the end of a day you want to see which bands were named without
  you, not four that look the same. It is also what keeps ADR 0012's "never written by a model"
  checkable once the agent writes.
- **Every act is a pure function in `libs/timetrack`** — open, resolve, delete, and plan what a create
  would file. The card is a thin caller with no logic of its own. The agent endpoint then grows ops
  and never moves code. Moving the logic later would mean moving it exactly when the agent starts
  filing issues that cannot be deleted.

**There is one write gate, and it is the sync.** Everything the agent may eventually do is preparation
the review can reject. The Jira create sits inside the review. You press it while reading the day,
never in the background.

## What the model is missing

- **`standInId?: string`** on `PinnedRow`, `ReviewedRow` and `ProposalOverride`. The last one so that
  naming a machine-proposed band is an override rather than a pin.
- **A `StandIn` record** and its matcher, in `model/`, mirroring `matchProjectLink`; a field on
  `TimetrackSettings` (`settings/model.ts:192`) with its default (`:298`); a reader in
  `parseTimetrackSettings` (`settings/parse.ts:299`) modelled on `asProjectLink`; `withStandIn` /
  `withoutStandIn` helpers like `settings/project-link.ts:11`; and mutators on the settings provider.
- **A third `AttributionTarget` kind.** Every consumer narrows (`=== 'issue'`, `=== 'donate'`), so a
  third kind falls through safely. Two display sites would lie and need a line:
  `attribution-rules.component.ts:66` renders `issueKeyOf(rule) ?? 'with the work beside it'`, which
  would label a stand-in rule as a donating rule, and `unnamed-work.component.ts:219` does the same.
  Stand-in rules **are** shown on the settings screen: a rule that names your time must be visible
  where rules live.
- **A stand-in target on `CallNaming`.**
- **A merge that does not lie.** `mergeRows` builds the merged row field by field and takes
  `first.issueKey` (`review/edits.ts:418`). A merge keeps the stand-in only when every row carries the
  same one, and otherwise the merged row carries none. `splitRow` spreads through `asPinned`
  (`edits.ts:170`), so a split copies it to both halves already.
- **`author: 'user' | 'agent'`** on the stand-in and on the rule.
- **The required-field defaults**, per project, per issue type, per field.

## Privacy

The stand-in name is free text the user wrote, so it needs two entries in the rules the roadmap
requires:

- It is **masked** on the way to the agent, like any other free text. A client name may well be in it.
- It is **never pruned** by retention. It is a setting and not an event, and a stand-in may legitimately
  outlive the events that opened it.

The name list the masking reads is grown by hand, with ADR 0013's existing rule doing the prompting:
every capitalised word the app does not recognise is marked before the send. One seed costs nothing —
the Jira project names the app already fetches through `fetchJiraProjects$`. Client names are what
matter, and they are exactly the project names. The address book is the largest privacy surface here
and nothing in this slice needs it.

## Exit test

Both, and the slice does not pass on one:

1. **The live case, end to end.** Open a stand-in on day 1. Work three days across two checkouts.
   Create the epic and both tasks from the card. All three days then book, with no row typed by hand.
2. **One real week.** Every band carries a Jira key, or a stand-in that names the work in Tom's own
   words. At the end of the week every stand-in is resolved, or waits on a person who is not Tom, and
   the card names what that person has to do.

Two scenarios against the fake backend are a condition of shipping, because the guards above are not
provable any other way:

- The fake Jira accepts the write and drops the response. Press create twice. The test passes only if
  the backend holds exactly one issue.
- The fake account has **no delete permission**, permanently. No scenario may clean up by deleting.
  Every test lives with what it filed, exactly as Tom does.

## Not in this slice

No booking — M6 owns the one path that writes to Tempo, and the first production write is a gated
one-way step. No epic written by an agent. No field editor for whatever `createmeta` returns. No
address book. No aggregate view over anyone else's time.
