# timetrack rows + review scan - open findings

Scan of `libs/timetrack/src/lib/rows` and `libs/timetrack/src/lib/review` from 2026-09-28. 0 High, 4 Medium, 21 Low, 4 Spec (verified 2026-09-28: 8 confirmed, 2 re-rated, 0 refuted, 0 unverified). Skipped (not read): `review/statements.ts`, `lane-issues.ts`, `call-pieces.ts`, `model.ts` (partly read); all specs.

## rows/merge

- Low: a named sliver is always dropped, because `absorbSlivers` only looks for hosts by `streamOf`, which is `undefined` for a named band (`rows/merge.ts:343-345, 364`). A 90-second FIP-1 touch that the span rule kept away from its FIP-1 band disappears from proposals and from `unattributed`. Also try hosts with the same `issue:` track. S Re-rated from Medium: the mechanism holds, but a sliver is under `minBandMs` (2 minutes), and the merge JSDoc accepts dropping a sliver no band takes, so the loss is under 2 minutes each.
- Low: the long `mergeBlocks` JSDoc sits above the JSDoc of `reconsider`, so it documents nothing (`rows/merge.ts:367-404`). Move it down to `mergeBlocks`. S

## rows/fill

- Low: `fillGaps` does not get the day's `breaks` as `claimed` (`rows/build-rows.ts:231-236`). A break and a fillable gap are both 15 minutes by default, so a break of exactly 15 minutes can be filled, and then the merge barrier sees no gap to bar. Add `options.breaks` to `claimed`. S

## rows/build-rows, snap, round

- Low: `...options.cut` is spread after `claimed` and `round` in the `cutBackground` call, so a `CutOptions.claimed` or `round` from the caller replaces the day's calls and increment (`rows/build-rows.ts:208-213`). Spread it first, or omit those two keys. S
- Low: every grid function floors or rounds the UTC epoch (`rows/snap.ts:10-11`, `rows/cut.ts:67,139`, `review/statements.ts:24-28`). An increment of 30 or 60 minutes puts rows off the local quarter in zones with a :30 or :45 offset (India, Nepal). Round on local time, or document the 15-minute limit. M
- Low: the `roundDurationUp` JSDoc says it is what a row books, but `propose` and `bookTheSpan` book the band span (`rows/round.ts:21-22`, `rows/propose.ts:109`, `review/review-day.ts:300`). Fix the text. S
- Low: a private `timeOfDay` is copied into `rows/timers.ts:33`, `rows/meetings.ts:47` and `rows/calls.ts:119`. Use `formatTimeOfDay` from `model/duration.ts:16`. S

## review/now


## review/review-day

- Low: `pinnedMs` sums the observed time of every tracked pin, also hidden pins and pins that matched an unnamed band, while `replacedMs` sums only consumed proposals (`review/review-day.ts:378-382`). This hides drift. Sum only pins whose sources are proposals. S
- Low: `ProposalOverride.durationMs` is read (`review/review-day.ts:54,67`), but no edit writes it (`setRowDuration` pins a range) and `bookTheSpan` overwrites `durationMs` with the span. Remove the field. S

## review/edits

- Low: `pinnedIdFor` builds `ISSUE@<from ISO>`, the same format as `proposalId` (`review/edits.ts:42-50`, `rows/propose.ts:61`). A split, a boundary move, a merge or a drag makes a pin whose id a later engine proposal can have. That proposal is then in `pinnedIds` and `reviewDay` drops it as consumed. `addManualRow` adds a `manual:` prefix for this reason (`review/edits.ts:440`). Prefix all pin ids and keep a read path for stored ids. M Re-rated from Medium: a colliding proposal must have the same issue and the same snapped start as a pin, and named bands of one issue already merge across lanes, so the dropped proposal almost always covers time the pin holds.
- Low: two JSDoc blocks are stacked on `setRowDuration`, and the first is stale (`review/edits.ts:169-174`). Delete the first. S
- Low: JSDoc rationale inside object literals is outside the comment allowlist (`review/edits.ts:75-78, 597-600, 612`). Delete or move to the function JSDoc. S

## review/fold, recut, nudge

- Low: a folded short row adds its `stretches` to the grown row even when the growth goes away from it or it lies more than one increment away (`review/fold.ts:105-111`). Stretches are then drawn outside the band. Clip them to the grown bounds. S
- Low: two background rows that overlap after a drag both keep the shared minutes, because `covered` leaves out background rows (`review/recut.ts:194`). Rank them the way `cutBackground` does. S
- Low: `joinTouching` keeps `last.durationMs` when it extends a stretch, so a joined stretch that already carries `durationMs` understates what it lost (`rows/cut.ts:213`). No current caller hits this. S
- Low: `isNudgeDue` compares the calendar minute of `now` (`review/nudge.ts:139,152`). With a `DayBoundary` after midnight, the work day's reminder stops at 00:00 instead of at the boundary. S

## Spec gaps

- Spec: no merge spec for a named sliver (`rows/merge.spec.ts`). S

## rows (second pass)

- Medium: `describeWork` never reads `timer` evidence, so the note a user types on a timer run never becomes the worklog description (`rows/describe.ts:17`, `rows/timers.ts:39`, `model/timer.ts:12`). A timer group has no blocks and no branch, so its row says `work on FIP-1`, and no other code reads `run.note`. Add `'timer'` at the top of `SUMMARY_PRIORITY`. S Verified.
- Medium: `issueKeyInText` tests only the first match of `keyPattern`, and returns nothing when that match has an unknown prefix (`rows/attribute.ts:127-133`). A title such as `UTF-8 fix for FIP-12` or `SCRUM-2 / FIP-12` names no issue, both for window titles and for calendar event titles (`rows/meetings.ts:327`). Use a global regex and return the first match with a known prefix. S Verified (repro).
- Medium: `serviceIn` returns the first product name a string contains, and `meet` comes first, so a Teams link (`teams.microsoft.com/l/meetup-join/...`) or a Webex link (`.../meet/...`) reads as Meet (`rows/meetings.ts:77-84, 202-208`). A call in the Teams app then rules out the one accepted Teams meeting, and the call stays unnamed. Match on the link host, or test the more specific names before `meet`. S Verified (repro).
- Medium: `epicQuestionOf` pairs a proposal's issue with every branch its checkout showed that day, because a row keeps no branch (`rows/epic-sibling.ts:199-209`). Checkout A books FIP-1 on `feature/FIP-1-x` and also shows an unnamed `feature/bracket-challenge`. The question then says A books FIP-1 on `bracket-challenge`, and `epicSiblingFor` names checkout B's `bracket-challenge` band from the parent of FIP-1. Take only branches whose own blocks name `proposal.issueKey`, or skip a checkout with more than one branch. M Verified.
- Low: `attribute` and `AttributeOptions` carry long rationale and ADR narration in JSDoc and in `/** */` blocks inside the function body, which the comment allowlist does not permit (`rows/attribute.ts:84-107, 110-121, 267-297, 319-337, 382-387`). Cut the exported JSDoc to one or two sentences and delete the inline blocks. S
- Low: `matchCalls` and `pickCandidate` carry rationale comments inside the function body (`rows/calls.ts:268, 274-286, 305-306, 433-437`, `rows/meetings.ts:200-201`). Delete them, or keep only a constraint a future edit could break. S
- Low: `conferenceIdOf`, `rememberedIssueKey` and `rememberedCallNaming` are exported through the rows barrel, but no code or spec outside their own file reads them (`rows/meetings.ts:60, 258`, `rows/calls.ts:153`). Remove the `export`. S
- Low: the `attendedAt` JSDoc says a call is one of the four things that show presence, but the function reads only window, idle and prompt events (`rows/attended.ts:40-43, 61-66`). Calls come in through `markAttendance({ claimed })`. Fix the text. S
- Low: `unnamedContexts` and `privateTime` are the same fold: sum `blockDurationMs`, widen `from`/`to`, sort by `observedMs` (`rows/rules.ts:10-35`, `rows/project-link.ts:17-37`). Extract one helper. S
- Spec: no spec for `describeWork` on a timer group with a note (`rows/describe.spec.ts`). S
- Spec: no spec for `issueKeyInText` where an unknown-prefix key comes before a known one (`rows/attribute.spec.ts`). S
- Spec: no `pickCandidate` spec with a Teams or Webex conference link (`rows/meetings.spec.ts`). S
