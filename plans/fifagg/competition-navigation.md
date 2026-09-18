# Fifagg competition navigation

Where the calls are drawn: `tools/design-explore` (`yarn design`, http://localhost:4402), calls under
`apps/timetrack/src/design/calls/fifagg/competition-navigation/`.

The source this redesigns is `/home/tom/dev/fifagg/fifagg-frontend`:

- Global header: `libs/domain/public/shell/src/lib/components/header/`. Floating bar, 60px tall,
  radius 20px, surface `gg-dark-2` `#19222D`, page `gg-surface-1` `#12171E`, side margin 15/20/30px,
  max width 1476px. Below `md` (768px) the zone links, the search and the login block move into the
  burger body layer.
- The strip this replaces: `libs/domain/public/competition/src/lib/partials/competition-navigation/`.
  Its items are mostly hardcoded per competition slug; one `@for` runs over `stage.children`. It
  overflows through `et-scrollable`, with arrows and edge masks.
- There is no `isLive` field. Live is `executionStatus === 'running'` on a stage or a phase.
  `stage-helper.service.ts` already picks the most relevant leaf stage.
- No drawer exists for competition pages. The header's own body layer is the only one.
- The accent is per competition: `gg-theme` → `var(--et-color-primary)`, set by
  `etThemeFromCompetitionSlug`. FeWC ft. eFootball Console is `#00FC06`.
- No competition ships an icon asset. The banner image is the only art.

## Settled

| Call             | Question                                                       | Won                                                                         | Lost                                                        |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 9 · attachment   | How does the sub-navigation attach to the floating header?     | A · second row inside the header card                                       | B · attached pill below; C · full-width band                |
| 10 · crowded row | What does the row hold when seven destinations do not fit?     | B · the live stage leads                                                    | A · one map control; C · pinned live with the strip below   |
| 11 · open map    | What opens when the row is used?                               | A · one mega panel, reusing the shipped hover panel and the drill-in drawer | B · two anchored menus; C · spotlight leads the panel       |
| 12 · long names  | How does the row carry a 44-character name with no icon asset? | A · two lines, one control (on the phone)                                   | B · live only, name in the page; C · the banner is the mark |

Calls 1 to 8 ran before the drawing tool dropped Angular. Their sketches no longer render; call 8
`call.ts` still records what each round ruled.

Standing decisions:

- The global header stays the source implementation. The competition row never replaces it.
- The row splits today's strip into what it really is: three pages about the competition, and the
  stage children, which carry `executionStatus`.
- No "you are on X" label.
- The competition button sits on the right and is the one control that opens the menu.
- The competition part of the bar wears a subtle competition theme gradient.

## Open

- **Call 13 · desktop row** (drawn, waiting on a ruling): what the desktop row does with the width
  the two-line phone shape does not need.
- **The status line's other states.** Live is one state of five: before the competition starts, a
  wait between stages, after the competition ends, and right after the announcement, when no stage
  exists at all and the overview page is the whole competition.
- **The hover-to-open morph.** How the competition button grows into the mega panel, on desktop
  hover and on a phone tap.
