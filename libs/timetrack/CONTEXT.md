# Timetrack

The domain of `@ethlete/timetrack`: what a person worked on, for how long, what the agents spent
on it, and which Jira issue it books to. The library holds the model and the pipeline. The
application in `apps/timetrack` is a consumer of both.

## Language

### What was worked on

**Context**:
Where work happened. A checkout with a branch, or an application when there is no checkout. A
context has no time of its own.
_Avoid_: workspace, project (a project is a Jira project), location

**Stream**:
One context's work across one local day: its blocks, its evidence and its spend. Several streams
run at the same time, and each books its full time.
_Avoid_: track, lane, timeline

**Stream key**:
The identity of a stream. It names the checkout, or the application when there is no checkout. It
does **not** name the branch — see ADR 0001.
_Avoid_: context key (that is the older, branch-bearing identity, kept for attribution)

**Block**:
Contiguous time inside one context, after idle gaps split it and sub-minute flapping is merged.
_Avoid_: interval, span, chunk, segment

**Sample**:
One raw observation that a block is built from. A focus change, an editor heartbeat, a commit.
_Avoid_: tick, datapoint, ping

**Evidence**:
A concrete observation a person can read back, attached to a block or a proposal. A commit
subject, a branch checkout, an agent session. A count is never evidence.
_Avoid_: source (a source is a collector), reason, proof

### What it is booked as

**Proposal**:
A block, or a set of merged blocks, attributed to a Jira issue, with a duration, a description, a
confidence and an evidence chain.
_Avoid_: suggestion, entry, draft

**Row**:
One line the user can review and book. Every row is attributed and can reach Tempo.
_Avoid_: line, item. A read-only line on the Today screen is a **stream**, not a row.

**Attribution**:
The assignment of a block to a Jira issue. Distinct from a Tempo _work attribute_, which is a
field on a worklog.
_Avoid_: mapping, matching, assignment

**Confidence**:
How well the evidence supports an attribution: `certain`, `likely` or `weak`. An enum, never a
number.
_Avoid_: score, certainty, probability

### Time

**Presence**:
Wall-clock time the person was at the machine, with overlaps counted once. It can never exceed
the length of the day. An agent that runs while nobody is there is not presence.
_Avoid_: active time, uptime, attendance

**Engaged time**:
The sum of every stream's blocks. It may exceed presence, and that is the point: two streams at
once are two lines of work, and both book their full time.
_Avoid_: total time, tracked time, worked time

**Rebuilt time**:
Presence no window and no idle transition observed, read back afterwards from the prompts the person
typed and the commits they made. It is part of presence, never a number beside it.
_Avoid_: reconstructed, recovered, inferred time

**Concurrency**:
Engaged time divided by presence. 1 is a serial day. 2.4 is a day that ran several agents.
_Avoid_: overlap factor, parallelism, multiplier

**Day**:
A local calendar day, written `YYYY-MM-DD`. Every total, every review and every sync is bounded
to one.
_Avoid_: date, period, session

**Focus time**:
The time the focused window held, every stream summed, clipped to what the machine watched. Less
than engaged time, which also holds an agent's time and rebuilt time.
_Avoid_: window time, active window time, screen time

**Unnamed focus**:
Focus time no checkout took, per application and per cause. It is the Other applications line split
by why each application is in it. A cause is not a verdict: `no-name` holds both a window a checkout
should have taken and an application that is no work context at all.
_Avoid_: unattributed focus (spend is unattributed), folded time, orphan time

**Gap**:
Unnamed focus of an application that named a checkout at another time in the span. The application
holds work, so the stretch it lost is the defect `plans/timetrack/name-the-window.md` fixes.
_Avoid_: defect, miss, wrong time

**Unknown focus**:
Unnamed focus of an application that never named a checkout. It is either no work context at all or
one no collector can read a name for yet, and the app says so rather than picking.
_Avoid_: other, unclassified, noise

**No work context**:
A standing statement that an application never holds a checkout — a music player, a chat client. It
is the one thing no collector can ever observe. A short list ships (media players, and the messengers
whose calls `TimetrackCallRules` counts instead, never Discord), and the user adds to it or takes an
application back off it one at a time. It is not an exclusion rule: the minutes stay in the day and
still reconcile.
_Avoid_: excluded app, ignored app, blocked app

**Window title**:
The text a compositor reports for the focused window. An unnamed focus row is split by it, so a
browser that lost an hour reads as a development server or as a news page rather than as one number.
A private checkout keeps none, because a title carries the checkout's name and a private project link
exists to hold that name out of every report.
_Avoid_: window name, tab title, caption

### Agents and spend

**Turn**:
One exchange with an agent model. It has an instant and a token cost. It is the unit spend is
collected in. It says the machine worked, never that a person was there.
_Avoid_: message, request, call, iteration

**Prompt**:
One thing the person typed at an agent, as an instant and a checkout. The text is never collected.
It is the one agent evidence that says somebody was at the keyboard — see ADR 0006. A prompt and a
turn are kept for a checkout no project link covers, and both drop for a private one.
_Avoid_: message, input, keystroke in prose

**Agent session**:
One run of an agent CLI in one checkout, identified by the provider's own session id. A subagent
runs inside its parent's session and belongs to the same stream.
_Avoid_: conversation, chat, thread

**Spend**:
What an agent's turns cost, in tokens. Five classes kept apart, because they are priced apart:
input, output, cache write, cache read, and thinking. Thinking is part of output, never added
to it.
_Avoid_: usage in prose (the type is `TokenUsage`), consumption, tokens as one number

**Cost**:
Spend converted to currency through the price table. A day with no price for a model it used
shows spend and no cost.
_Avoid_: price (a price is a rate per million tokens), charge, bill

**Provider**:
The agent CLI a turn ran on: `claude-code` or `codex`. One provider is one parser and one price
table.
_Avoid_: vendor, tool, backend (the backbone is Jira and Tempo)

### Collection

**Collector**:
The component that turns one outside thing into collected events. Window focus, idle, git, agent
sessions, Jira, Tempo, GitLab, Google Calendar.
_Avoid_: watcher, poller, importer

**Source**:
The name a collector's events carry, and the unit that exclusion and retention rules apply to.
_Avoid_: origin, channel

**Capability**:
One thing a running source can, or cannot, observe on this machine. The focused-window source reads
an application id, a title and a working directory, and which of the three it reads depends on the
platform and the compositor. A source that cannot observe something says so, so that the time it
therefore fails to name reads as a missing capability and not as a wrong number.
_Avoid_: feature, permission (a permission is one reason a capability is missing)

**Pass**:
One walk over one agent's session logs, with cursors of its own. There is a session pass, a spend
pass and a prompt pass per provider, and no two passes share a cursor. See ADR 0003 and ADR 0005.
_Avoid_: run (a run is one tick of one pass), scan, sweep

**Backbone**:
The issue tracker and the timesheet the app books into. Jira and Tempo for now. The ledger stays
adapter-agnostic, so a later backbone can replace them.
_Avoid_: integration, provider (a provider is an agent CLI)
