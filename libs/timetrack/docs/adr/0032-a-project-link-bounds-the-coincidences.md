# A project link bounds the coincidences, and a sibling's stand-in outranks them

On 2026-09-23 a band in `fifagg/fifagg-frontend`, on `feature/20260819_bracket-challenge`, read
`FIP-2867` at `weak`. That issue is a "PM & Meetings" story in project `FIP`. The checkout is linked to
`FIFAGG`, no event of the day names `FIP-2867`, and the `specs` checkout of the same project held an
open stand-in, "Bracket challenge", for `context/tracks/20260819_bracket-challenge` — the same slug.
The ladder never looked at it: nothing but a rule could put a stand-in on a band, so the band fell
through to the coincidence rungs, and one of them named an issue from a project the checkout does not
log into.

Two decisions follow.

**A linked checkout takes no coincidence from another project.** The rungs that read a coincidence —
an issue opened while the block ran, a recurring Tempo pattern, a key in a window title, and the model
inference — skip any key whose project differs from the link's. A pattern list is filtered before the
strongest is picked, and a title naming another project hands over to the next title. The link is the
user's own statement of which project the time belongs to, and a coincidence cannot outrank a
statement. A merge request opened for this exact branch is not a coincidence and is not filtered. With
no project link, nothing changes.

**An open stand-in a sibling checkout holds for the same slug names the band.** It is the stand-in
counterpart of ADR 0029: same project (both links resolve to the stand-in's `projectKey`), same branch
slug, exactly one match, only `open` records, and never where a rule already names the checkout. A
stand-in's slug is `branchSlugOf` its `openedForBranch`, and where that branch is protected — `specs`
works on `main` — the last segment of `openedForWorkPath`. It reports `likely` with a
`sibling-checkout` evidence line naming the checkout that holds it.

## Where it sits

Under the epic rung, because a real issue a sibling names by elimination is exactly what ends a
stand-in (ADR 0021, ADR 0029). Under a merge request opened for this branch, for the same reason.
Above every coincidence rung, because a record the user accepted for this work beats an issue that
happened to be open.

That splits the old activity rung in two. A merge request on this branch keeps its place above the
project-wide rule; an issue merely viewed during the block now sits below the epic and stand-in rungs,
at the top of the coincidences — and below a project-wide rule, which it used to beat.

## Consequences

- A band that used to carry a wrong key from another project is now unnamed, or named by a stand-in.
  An unnamed band costs the user one answer; a wrong key costs them noticing it.
- Two open stand-ins of one project on the same slug name nothing, like two free children in ADR 0029.
- The rung writes no rule, for the reason ADR 0029 gives: it is recomputed each read, and resolving the
  stand-in or opening a second one changes the answer.
