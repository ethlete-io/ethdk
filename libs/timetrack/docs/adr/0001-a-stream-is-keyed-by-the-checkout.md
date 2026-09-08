# A stream is keyed by the checkout, not by the checkout and the branch

The existing `contextKey` identifies a context as `repo:<path>@<branch>`, and the concurrency
measurements that justified the stream model bucketed by `cwd@gitBranch` too. We key a **stream**
by the checkout alone, and treat the branch as a label on the blocks inside it.

The reason is the locked "no git flow" decision: development runs in chaos style, so a branch name
carries no work identity. One checkout switches branch several times a day, and a branch-bearing
key would split one line of work into several streams with nothing meaningful between them. A key
is an identity claim, and the branch cannot support one here.

## Consequences

- `contextKey` is **not** changed. It is the block-continuation identity in `sessionize`, the
  `UnnamedContext.id` and the `InferredAttribution.contextId`, so a change to it reaches
  attribution. The stream model gets a second function beside it.
- The branch is still collected, still shown, and still evidence. The attribution rung that reads
  it can be added later, which is what "adding git flow later should be a breeze" means in code.
- A day in one checkout across three branches is one stream, not three. That keeps the line count
  on the Today screen readable, and it keeps `maxRowsPerDay` reachable.
- Five consoles running agents in one checkout are one stream, not five. The time does not inflate,
  because blocks are intervals and overlapping sessions extend one block rather than sum; only the
  spend sums. A session id changes at every console restart, so a session-keyed stream could not be
  named and could not carry a rule — and naming is what slice 2 is for. If a real day shows one
  checkout holding two clearly different tickets, slice 2 needs a stream split.
