# A sibling checkout names the child by elimination

> **Implements [ADR 0009](./0009-the-branch-slug-names-the-epic.md)**, which decided that a slug finds
> the epic and the epic plus the checkout finds the task, and left open how the second half is done.

ADR 0009 states the rule and not the method. The epic is easy: it is the parent of the issue another
checkout on the same branch slug already books. The task is the hard half, because **nothing in Jira
links a child to a checkout**. No field names a repository. The issue types are whatever the person
who filed them chose, so `spec` work is a `Task` as often as it is anything else, and the branch slug
is by definition the same string on both sides. Every property that could pick the right child out of
an epic is either absent or shared.

What the app does know is what the rest of the day books. So the child is found by taking those away:
**the parent's open children, minus every issue key any checkout already books, and if exactly one is
left it names this block.** The evidence says so in those words — `` `fifagg-frontend` books
FIFAGG-12624 on the same branch name; FIFAGG-12623 is the only other open child of FIFAGG-12605
(Epic) ``.

Elimination is not a heuristic that usually wins. It is a proof that holds only when the set is small
enough to close, and the rung refuses to answer whenever it is not:

- The two checkouts must resolve to the **same Jira project**. A slug two clients happen to share is a
  coincidence, and ADR 0009 already bars naming a band from one.
- The matching siblings must agree on **one parent**. Two parents mean the slug spans two epics, and
  which one this checkout hangs under is exactly the open question.
- The child list must not be **truncated**. `epicChildLimit` caps the read, and elimination over a
  list that was cut short is a guess wearing a proof's clothes.
- Exactly **one** child may be free. Two free children is the state this rung exists to resolve, and
  it cannot.

Each of those leaves the block to the rungs below, unnamed. A wrong ticket costs more than an unnamed
band, and an unnamed band is what the user already has today.

## Two reads of the day, and never a loop

The rung needs three Jira reads — the candidates' `parentKey`, the parents' `issueType`, and the
parents' open children — and the core makes no call of its own. Every rung above it takes its
evidence pre-fetched, so this one does too: `epicSiblingFor` is handed an `EpicOptions`, and
`AttributeOptions.epics` is empty until somebody fills it.

Filling it needs the day's own answers, because elimination subtracts them. So the day is read
**twice**. The first read runs with no `epics`, which leaves the rung inert and yields the rest of the
ladder's conclusions. `epicQuestionOf` narrows those to the checkouts that are named and share a slug
with one that is not, plus every key already claimed. The three reads follow. The second read runs
with `epics` filled, and the rung answers.

**Two, fixed, never a loop.** A third read would see the names this rung just added, find new
candidates in them and ask for more. That converges on nothing in particular and costs a Jira read per
turn, so it is not offered as a setting or a depth. The first pass is the question and the second is
the answer.

`epicQuestionOf` returns no question at all when the day has no unnamed checkout with a slug, or no
named checkout sharing one. A day the other rungs answered in full therefore costs **zero** requests,
and so does a day where nothing is named. On the app side `injectEpicSiblings` follows one day and
keys the three reads on the question, so the day stream's repeated emissions do not re-spend them.

## Read above the stand-ins, answered below them

The rung sits low: under the branch grammar, under both issue-rule rungs, and under the activity rung,
because each of those is either a statement or an observation, while this is an inference. It sits
above the Tempo pattern rung, the window-title rung and the model rung, which read coincidences. The
`donate` short-circuit stays above it — a user who said this work belongs beside other work has
answered the question already. It reports `likely`, never `certain`, with an evidence kind of
`sibling-checkout` and the parent as the `storyKey`.

There is one exception to reading a rung where it answers: **the two stand-in rungs consult this one
before they fire**. A stand-in exists because Jira held no ticket for the work. The day a sibling
checkout names a real issue, that premise is gone, and a stand-in that fired anyway would have to be
taken back by hand. So both stand-in branches carry a `!epic` guard, and the epic is computed before
them though it is returned after.

## It writes nothing and offers nothing

ADR 0025 says a checkout-wide answer is offered and never learnt. This rung does not even offer. Its
conclusion depends on the state of the whole day and on which children of an epic are still open, and
both change: one new ticket under that epic makes two children free, and the proof stops holding.
Writing an `AttributionRule` from it would freeze a conclusion that a later read falsifies, and the
user would carry the wrong ticket forward with no sign of where it came from. The rung names the band
each time it is computed, from the evidence that holds at that moment, and nothing else.

## Consequences

- **`epicChildLimit` is settable and `DEFAULT_NAMING_QUIET_AFTER_DAYS` is not**, and the line between
  them is what the number does. A cap on a child list guards a **network read**: a user whose epics
  hold two hundred children needs a bigger one, and raising it changes no judgement about anybody's
  work — a truncated list answers nothing either way. A quiet period states a **judgement**, that work
  this old is no longer worth asking about, and a setting for it is the app declining to have an
  opinion it ought to hold.
- **A truncated read is silent, not partial.** `truncated` is carried out of the fetch and checked
  before elimination, so raising the cap can only turn a silence into an answer. It can never change
  one answer into another.
- **A row keeps no branch, so the branch is read back from the day.** `WorklogProposal` carries a
  `laneKey` and nothing about git, so `epicQuestionOf` maps the lane to a checkout and reads that
  checkout's branches out of `StreamDay.blocks`. An `AttributionRule` carries its branch directly,
  which is why the rules are the first source of candidates and the day's own answers the second.
- **A branch type the git-flow grammar does not know still yields a slug.** `parseBranch` returns
  `unknown` with no subject for those, and `branchSlugOf` falls back to the last `/` segment. A
  protected branch and a single-segment name yield nothing at all: `master` and `wip` name no work two
  repositories have in common.
- **The fake Jira backend had to learn `parent = "…"`.** `libs/timetrack/testing/backend/jql.ts`
  ignored that clause, so every issue in a fixture read as a child of every parent and the rung
  appeared to work for the wrong reason.
- **On Tom's machine the rung is correct and silent.** `spec/20260819_bracket-challenge` in
  `fifagg/specs` and `feature/20260819_bracket-challenge` in `fifagg/fifagg-frontend` share a slug,
  and FIFAGG-12623 and FIFAGG-12624 are both open children of the epic FIFAGG-12605. Both checkouts
  currently carry a repo-scoped stand-in rule, so neither names a real issue, so there is no sibling
  to inherit from. The rung starts answering the moment one of them is resolved — which is the
  behaviour ADR 0009 asked for, not a gap.
