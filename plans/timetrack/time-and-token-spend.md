# Time and token spend, per work stream

Scope worked out with Tom on 2026-09-08. It replaces two things in `plans/timetrack.md`: the
serial block model that section **Correlation → Sessionize** describes, and the silence about
token spend everywhere else.

Everything measured below was measured on this machine, from `~/.claude/projects` and
`~/.codex/sessions`, on 2026-09-08. Each measurement names its own method, so a later session can
repeat it and get the same numbers.

## The change in one sentence

A day is not one timeline. It is a set of work streams that run at the same time, each with its
own observed time and its own token spend, and each booked in full.

## Why the focused window cannot be the baseline

One minute of wall clock can hold work on two tickets. Today `sessionize` keeps one sticky
context and one open block, so it answers the wrong question: it reports what was in front of the
user, not what was worked on.

**Method.** For every top-level Claude Code session log, take each record's `timestamp`, `cwd` and
`gitBranch`. Bucket the records into local minutes. Count the distinct `cwd@gitBranch` pairs per
minute. Subagent logs are left out, because a subagent runs inside its parent session and in the
same checkout, so it is one stream, not two.

| Local day  | Minutes with a sample | Of those, 2 or more contexts | Most contexts in one minute |
| ---------- | --------------------: | ---------------------------: | --------------------------: |
| 2026-08-12 |                   750 |                   421 (56 %) |                           6 |
| 2026-08-18 |                   583 |                   319 (54 %) |                           7 |
| 2026-08-17 |                   646 |                   276 (42 %) |                           6 |
| 2026-09-02 |                   729 |                   268 (36 %) |                           5 |
| 2026-08-28 |                   649 |                   110 (16 %) |                           3 |

Codex is the same shape. Of 16 rollout logs under `~/.codex/sessions`, 8 start before the log
before them ends.

Between a sixth and a half of a working day holds two or more live contexts. That is not an edge
case, so the model has to hold it.

## Decisions locked

| Question           | Decision                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Overlap            | Both streams book their full time. Wall-clock time is never split between them.                      |
| Wall clock         | Reported beside the streams as presence, and never inflated. The two numbers stay apart.             |
| Over-capacity day  | A day may total more than its presence. The day says so; it does not correct itself.                 |
| Exclusivity        | Focus-derived time is exclusive. Agent-derived time may overlap. See the rule below.                 |
| Token spend        | Collected per turn, rolled up per stream, per proposal, per day and per week.                        |
| Token headline     | A cost estimate, not a token count. 98 % of all tokens are cache reads.                              |
| Price table        | A user setting, shipped empty. No price is hardcoded in the app.                                     |
| Sources            | Claude Code and Codex CLI. Both log shapes are verified below.                                       |
| Backbone           | Jira and Tempo for the MVP. The ledger stays adapter-agnostic, so a later backbone can replace them. |
| Ticket granularity | Fewer, larger tickets. The app must never push the user to split work into subtasks.                 |
| Presence           | Unchanged. An agent that runs while nobody is at the machine is still not time.                      |

### Why both streams book their full time

Tom's words: if you worked on two things at the same time, both tickets need their time booked.
Two consequences follow, and both are wanted.

1. **A day can total 14 hours of engaged time inside 8 hours of presence.** That is the truth the
   ledger records. A timesheet that scales it down to 8 hours hides the thing worth seeing.
2. **Tempo will hold more hours than the day had.** Tempo accepts it; its capacity reports will
   read above 100 %. The plan accepts that for the MVP, and the review screen states the ratio
   before a sync, so nobody is surprised by it. A `scaleToPresence` setting is listed under **Open
   questions**, and it is off by default.

Token spend is the reason this matters beyond honesty. An agent does most of a feature, so the
minutes a person spends stop being the size of the work. Tokens are the metric that keeps growing
with the work, and a stream that books its own full time is the only place they can be attached.

## What the logs actually hold

### Claude Code

Every assistant record carries `timestamp`, `cwd`, `gitBranch`, `sessionId`, `message.model` and
`message.usage`. One real `usage` value, trimmed to the fields that matter:

```json
{
  "input_tokens": 2,
  "cache_creation_input_tokens": 17421,
  "cache_read_input_tokens": 18910,
  "output_tokens": 289,
  "output_tokens_details": { "thinking_tokens": 0 },
  "service_tier": "standard"
}
```

Four facts the parser has to respect:

- **Subagent logs are never read today, and that is a bug to fix before the backfill.** `list_logs`
  in `apps/timetrack/src-tauri/src/logs.rs:55` walks exactly two levels,
  `<root>/<project>/<log>.jsonl`, and a subagent log sits one level deeper. Measured on this machine
  on 2026-09-08: 556 reachable logs, 50 unreachable ones holding 1 814 distinct turns. Their share of
  all cache reads is only 2.1 %, but it is spiky — one real session held 128 subagent usage records
  against the main log's 103. Fix the Rust enumeration first, so the backfill of ADR 0003 reads both
  in one pass. A backfill that has to be run twice will be run once.
- **Subagent turns live in their own files**, under `<sessionId>/subagents/agent-*.jsonl`. In one
  real session the main log held 103 usage records and the four subagent logs held 128 more. No
  `message.id` appeared in both, so the totals must be summed across both, and a subagent's spend
  belongs to its parent's stream. **A subagent record already names the parent** in `sessionId` and
  the subagent in `agentId`: 6 723 of 6 723 subagent records on this machine carry the parent's id,
  so the event needs `agentId`, not a `parentSessionId`. Measured on 2026-09-08.
- **One turn is written as several records**, one per content block, and each restates the same
  `message.usage`. Of 93 643 usage records in the main logs, 42 849 repeat a `message.id`, and a
  repeated id never carried different counts. So the first record of an id wins, and the dedupe is
  not only about older versions writing sidechain records into the main log.
- **`message.id` is the dedupe key.** Older Claude Code versions wrote sidechain records into the
  main log instead. A resync must not count a turn twice, and the message id is what prevents it.
- **`model` can be `<synthetic>`**, with every count at zero. Skip it, or the model list grows an
  entry nobody recognises.
- **`usage.iterations` repeats the same counts** the record already states at the top level. Read
  the top level only.

### Codex CLI

Logs live at `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-<iso>-<id>.jsonl`. Three record types
carry what is needed:

| Record         | Field                                                      | Use                     |
| -------------- | ---------------------------------------------------------- | ----------------------- |
| `session_meta` | `payload.cwd`, `payload.session_id`, `payload.cli_version` | Stream identity         |
| `turn_context` | `payload.model`, `payload.effort`, `payload.cwd`           | The model a turn ran on |
| `event_msg`    | `payload.type == "token_count"`, `payload.info`            | The spend               |

A `token_count` payload:

```json
{
  "total_token_usage": {
    "input_tokens": 14461,
    "cached_input_tokens": 11008,
    "cache_write_input_tokens": 0,
    "output_tokens": 127,
    "reasoning_output_tokens": 25,
    "total_tokens": 14588
  },
  "last_token_usage": {
    "input_tokens": 14461,
    "cached_input_tokens": 11008,
    "cache_write_input_tokens": 0,
    "output_tokens": 127,
    "reasoning_output_tokens": 25,
    "total_tokens": 14588
  },
  "model_context_window": 258400
}
```

Four facts here too:

- **`total_token_usage` is cumulative for the session; `last_token_usage` is the turn.** Sum the
  turn values. Summing the totals multiplies the day by the number of turns.
- **`payload.info` is often `null`.** Such an event reports rate limits only. Skip it.
- **Codex logs no git branch.** `session_meta` has `cwd` and no `git` field. The branch has to come
  from the git collector's state for that checkout at that time, which the host already reads.
- **The names differ from Claude Code.** `cached_input_tokens` is a cache read,
  `cache_write_input_tokens` is a cache write, and `reasoning_output_tokens` is thinking. Map them
  into one shape in the parser, never later.

### The token classes are not one number

**Method.** Sum every Claude Code `usage` record whose local day is 2026-08-12, main logs and
subagent logs together. 11 094 records.

| Class                         |                        Tokens |
| ----------------------------- | ----------------------------: |
| `cache_read_input_tokens`     |                    1 416.03 M |
| `cache_creation_input_tokens` |                       21.12 M |
| `output_tokens`               |                        7.96 M |
| of which thinking             |                        3.36 M |
| `input_tokens`                |                        0.07 M |
| Model                         | `claude-opus-5` for all of it |

Cache reads are 98 % of the total, and they are the cheapest class. So a single "tokens spent"
number is useless for pricing: it tracks how long the context stayed warm, not how much work was
done. Store the five counts, and make the headline a cost estimate.

The same day, grouped by context, all classes summed:

| Context                                 |   Tokens |
| --------------------------------------- | -------: |
| `fut-frontend@feat/hub-review-feedback` | 707.27 M |
| `ethlete-sdk@next`                      | 603.99 M |
| `src-tauri@next`                        |  19.13 M |

`src-tauri` is the third row, and it is not a repository. It is a subdirectory of `ethlete-sdk`.
So the `repoRoots` folding that `sessionize` already does has to run over usage as well, or the
cost of a checkout is reported in pieces.

## The model change

### 1. A stream is the first-class thing

```ts
/** A line of work that ran on its own. Several are live at once, and each books its own time. */
export type WorkStream = {
  /** `contextKey(context)` — the repo and branch, or the app when there is no checkout. */
  key: string;
  context: ActivityContext;
  blocks: ActivityBlock[];
  /** What the agents spent inside this stream. Absent where no agent ran in it. */
  usage?: TokenUsage;
};
```

`ActivityBlock` does not change. What changes is that blocks no longer form one sequence: each
stream holds its own, and two blocks in different streams may overlap.

`sessionize` becomes `sessionizeStreams`. Today it keeps one `current` block, one `appId` and one
sticky `repoPath`. It will keep a map from stream key to that same state, so each stream opens,
extends and closes on its own evidence. The rules that were found the hard way — the 30-minute
safety valve, the stickiness, the flap absorption, the contiguity check — all stay, and all become
per stream.

The old single-timeline output is still needed. `DayCorrelation.blocks` feeds the timeline half of
the review UI, and the tray reads one current activity. Keep both as a flattened view over the
streams, so nothing downstream has to change at once.

### 2. The exclusivity rule

Two streams may overlap only where each one has its own independent evidence. Focus is one thing
at a time, so focus-derived time cannot be claimed twice.

| Evidence           | Exclusive or concurrent | Why                                                    |
| ------------------ | ----------------------- | ------------------------------------------------------ |
| `window-focus`     | Exclusive               | One window has focus. It names one stream per instant. |
| `editor-heartbeat` | Exclusive per reporter  | A reporter posts while its own window has focus.       |
| `agent-session`    | Concurrent              | Agents run at the same time, in different checkouts.   |
| `git-commit`       | Instant                 | It labels a stream. It never opens or extends one.     |

Without this rule the day inflates for nothing: a browser stream and a Slack stream would overlap
every coding stream on the strength of the same focus samples, and the ratio the review screen
prints would stop meaning anything. With it, an overlap always answers "which two agents ran".

### 3. Presence stays global

The 7-hour bug in `plans/timetrack.md` came from an agent that held a block open after the user
left. Its fix stays exactly as it is, and it stays global: from an `idle-start` or a `lock` until
the input that ends it, no stream opens or extends. A stream is not a reason to be present.

Repo and branch are still learned while away, per stream.

### 4. What a day reports

```ts
export type DayTotals = {
  /** Wall clock the user was at the machine, with overlaps counted once. Never above 24 hours. */
  presenceMs: number;
  /** The sum over streams. It may exceed `presenceMs`, and that is the point. */
  engagedMs: number;
  /** `engagedMs / presenceMs`. 1 is a serial day; 2.4 is a day that ran five agents. */
  concurrency: number;
  usage: TokenUsage;
  /** The cost estimate, when the price table covers every model the day used. */
  cost?: CostEstimate;
};
```

`presenceMs` is the union of every stream's blocks, so it is the one number a person can check
against their own memory of the day. `checkDay` gains a ceiling warning as a setting, **off by
default**. The earlier claim here — that a day at 6.0 is more likely a broken exclusivity rule than a
real one — is wrong for this user, and it was corrected on 2026-09-08. Tom's words: five consoles
running Claude at once, some with subagents, while he is in a meeting or tests in the browser. That
is a real day above 6.0. Turn the ceiling on once three real days have been measured. A threshold
nobody measured is exactly the kind of thing that makes a screen untrustworthy.

## Token spend

### The event

Usage is not a property of a session. It is a property of a turn, and a turn has an instant. So it
is its own event, and it maps to a block by its instant, exactly as a commit does.

```ts
export type AgentUsageEvent = CollectedEventBase<'agent-usage', 'agent-usage'> & {
  /** `claude-code` or `codex`. One provider is one parser and one price table. */
  provider: string;
  sessionId: string;
  /** The provider's own id for the turn. The dedupe key, with `provider`. */
  turnId: string;
  cwd: string;
  gitBranch?: string;
  model: string;
  usage: TokenUsage;
  /** The subagent that ran the turn. Its spend belongs to the stream of `sessionId`. */
  agentId?: string;
};

export type TokenUsage = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** Part of `output`, not added to it. Kept apart because it is priced as output but read as work. */
  thinking: number;
};
```

`agent-usage` joins `CollectedEventSource`. It is **not** an `ActivityEvent`: a turn that finished
at 02:00 must not open a block, and `isActivityEvent` already states that rule for calendar and
GitLab events. The one difference is that an agent session event at the same instant does open a
block, so the day loses nothing.

### Dedupe and resync

The store's dedupe key is `provider + turnId`. For Claude Code `turnId` is `message.id`; for Codex
it is the rollout's `session_id` plus the event's `ordinal`. Both are stable across a re-read, which
is what makes the resync in `agent-session/resync.ts` safe to run over usage too.

### Cost

```ts
export type ModelPrice = {
  model: string;
  /** Currency per million tokens, per class. A class the provider does not bill gets 0. */
  perMillion: { input: number; output: number; cacheWrite: number; cacheRead: number };
};
```

The price table is a setting and ships empty. Three reasons, in order:

1. A hardcoded price goes stale, and a stale price becomes a wrong invoice.
2. A user's plan is not the list price. Some of this spend is a subscription, and its marginal price
   is zero.
3. The app already refuses to guess elsewhere. A day with no price shows counts and no cost, the
   same way an unlinked path stays an unnamed context.

The settings screen lists every model the store has seen, so the table is filled from the user's own
history rather than from a list the app invented.

### Where the rollup lands

It lands in the stream model, not in `correlate`. See the correction to build-order step 1 below.

- `ActivityBlock` gains no usage field. A block is an interval; usage is summed onto it on demand.
- `WorklogProposal` gains `usage?: TokenUsage` and `cost?: CostEstimate`, summed over the blocks the
  proposal was merged from.
- `DayCorrelation` gains `totals: DayTotals`.
- `week.ts` gains the same two per row, so the week answers "what did this ticket cost".
- Tempo gets nothing new by default. Whether a worklog description carries the cost is a setting,
  and it is off: a number in a description cannot be corrected later, and Tempo has no field for it.

### What usage is not

Usage is a count. It is not evidence, so `EvidenceKind` gains nothing, and no token number joins
`QUOTABLE_EVIDENCE_KINDS`. Nothing about a prompt or a message body is read. Retention needs one
decision of its own: raw samples expire on a window, and a cost history that expires with them is
worthless. Usage rows are aggregates with no content, so they are kept past the sample window, per
day and per stream.

## What must not break

1. **The presence rule.** An agent that runs overnight must stay out of the day. There is a spec for
   the 2026-08-10 case; it has to keep passing per stream.
2. **Timer displacement.** `clipBlocks` cuts a timer's window out of the reconstruction. Per stream
   it has to cut from every stream, or a timer displaces one stream and the day proposes the hour
   twice for a wrong reason.
3. **Pauses and private links.** Both are global statements about time. They apply to every stream.
4. **`maxRowsPerDay`.** Streams produce more rows by construction. Check the ceiling against a real
   replayed day before the default is trusted.
5. **The 48-to-21 block result.** The `repoRoots` folding is what produced it. Per-stream sessionizing
   must not regress it, and the same day is the way to check.

## Build order

Each step is shippable, and each has its own specs. Steps 1 and 2 are the "back to basics"
collection work; step 3 is the model change.

1. **Token usage in the model and in the Claude Code parser.** `TokenUsage`, `AgentUsageEvent`, the
   parse of `message.usage`, the subagent files, the `<synthetic>` skip, the `message.id` dedupe.
   **Done, apart from the rollup, and the rollup is cancelled.** It was to sum spend onto
   `ActivityBlock` and `WorklogProposal` inside `correlate/`. That feeds `day-review/`, which slice
   3 deletes, so the work would be paid for twice. `vertical-slices.md` wins. The week reads its
   spend from the stream model instead. Corrected on 2026-09-08.
2. **The Codex collector.** The rollout reader, the field mapping, the `info: null` skip, the branch
   from the git collector. It is the second provider, which is what proves the shape is not
   Claude-shaped by accident.
3. **`sessionizeStreams`.** The per-stream state machine, the exclusivity rule, the flattened view
   for the timeline and the tray, `DayTotals`.
4. **The review UI.** Overlapping lanes in the day timeline, presence against engaged time, the
   concurrency ratio, cost per row. The `checkDay` warning for an impossible ratio.
5. **The price table setting**, filled from the models the store has seen.
6. **The week and the cost report.** Cost per issue, per project and per week.

Replay every step against 2026-08-12, 2026-08-17 and 2026-08-18. All three are measured above, and
all three are real multi-stream days.

## Open questions

1. **`scaleToPresence`.** A customer who bills wall clock needs the day scaled down to presence. It
   is a Tempo-adapter setting, off by default, and it belongs to the adapter, never to the ledger.
   Build it when a real invoice needs it.
2. ~~**A stream with no keyboard at all.**~~ **Answered on 2026-09-08.** It books its full time, and
   its line carries `agent only, never focused` as evidence. No confidence step in slice 1.
3. **A subagent has no readable name.** A subagent log carries `agentId`, `sessionId`, `cwd`,
   `gitBranch` and `attributionAgent`, and `attributionAgent` names only the agent type —
   `general-purpose` in 1 868 records, `Explore` in 44. There is no `ai-title`. The description the
   parent passed is not recoverable either: `sourceToolAssistantUUID` resolved to a record in the
   parent log in **0 of 40** pairs tested. So spend can be attributed to a stream but never named
   inside it. The agreed shape is a `PostToolUse` hook on the Agent tool that writes one JSONL line
   per spawn — `agentId`, `description`, `subagent_type`, `model`, the parent `sessionId` and the
   instant — shipped in `@ethlete/agent-rules`, so any repository that installs the rules gets it.
   The collector joins on `agentId`, and degrades to "an unnamed subagent" where the file is absent.
   **Its own small slice, after slice 1**, never before: slice 1 is what tells us whether subagent
   spend is worth naming on a real day.
4. **The week shows no spend until slice 6.** Accepted on 2026-09-08. A direct per-day sum now would
   be a second spend path that slice 6 deletes.
5. **Other agent CLIs.** Cursor, Copilot CLI and Gemini CLI are out of scope. The `provider` field
   and the price table are what keep the seam open.
6. **Subscription against list price.** A cost estimate at list price overstates what a subscription
   day cost. A second, per-plan price mode may be needed once the numbers are used for pricing.
