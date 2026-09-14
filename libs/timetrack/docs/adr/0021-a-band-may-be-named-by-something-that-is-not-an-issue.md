# A band may be named by something that is not a Jira issue

Work starts before Jira holds a ticket for it. Tom began a feature on 2026-09-14 with no epic and no
task under one, and the naming ladder found the project and the branch slug and nothing else. The
report to the project manager that M4 planned goes to another person, who answers next week, while the
work continues. Every day of it asks the same question, because nothing in the model can hold a name
that Jira does not hold yet.

So a band may carry a **stand-in**: a name the user gave the work, which takes bands across days and
across checkouts, books nothing, and is resolved to an issue in one act later.

**It is carried in `standInId`, never in `issueKey`.** `isNamedRow` (`review/model.ts:73`) is a bare
`!!row.issueKey`, and six paths funnel through it — the Tempo preview (`sync.ts:78`), rounding
(`review-day.ts:94`), `checkDay`, the nudge, the tray readout and `defaultState`. A stand-in id in that
field would pass every one of them and read as bookable time, and no code anywhere checks that an issue
key is shaped like one. A sibling field inherits "shown, counted undecided, never written" for free.

**The identity is an opaque id, and the matches live on attribution rules.** `AttributionTarget`
(`model/attribution.ts:14`) gains a third kind, `{ kind: 'stand-in'; standInId }`. `matchAttributionRule`,
`scopeOf`, `SCOPE_RANK` and the settings storage then all apply unchanged, and a resolve becomes one
rewrite: every rule pointing at the stand-in takes `{ kind: 'issue'; issueKey }` instead. A branch
renamed mid-feature costs one press and never a second stand-in. `CallNaming` gains the same target,
because a call is named on a different path and would otherwise ask again every week.

The alternative was to key a stand-in on the slug itself. It is simpler and it breaks twice: a rename
opens a second one, and two checkouts that word the same feature differently never meet.

## Consequences

- A stand-in rule sits at rung 2 of the ladder, branch-scoped (`rows/attribute.ts:243`). It beats an
  MR match, a Tempo pattern, a key in a window title and a model inference, and it loses to rung 1.
  That is what ends it cleanly: on the day the branch names the real key, rung 1 wins and the stand-in
  steps aside with nobody telling it to.
- **A third bucket appears.** The nudge splits rows into undecided and unsynced (`nudge.ts:85`). A
  stand-in band is neither, so it is **waiting**: undecided means the user owes the app an answer,
  waiting means the app owes the user a ticket.
- A merge must stop taking the first row's value. `mergeRows` builds its row field by field and takes
  `first.issueKey` (`review/edits.ts:418`). A merge keeps the stand-in only when every row carries the
  same one. Under the existing behaviour a stand-in band merged with a named band would silently keep
  whichever was drawn first.
- The word **placeholder** was rejected for this. `WORK_START_KEY_PLACEHOLDER` (`ticket/start.ts:11`)
  already means a key-shaped stand-in inside a branch name, and every form control in the app uses
  `placeholder` for the HTML attribute.
