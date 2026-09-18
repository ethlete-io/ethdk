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
- `CompetitionView` carries `name` and nothing else name-like. `shortName` exists only on
  `BaseStageView`, is nullable, and is often the full name again, so it is not a short label.
- `videoGameType` is a field of the competition, so the `ft. eFootball` tail inside a name is data
  the row already holds without reading the name string.
- The longest real names run to 56 characters, for example
  `[PlayStation] DFL eFootball Challenge 2023 - Qualifier 1`.
- The page states the name twice before the row could state it a third time: inside the banner art,
  and as the page heading right below the header.

## Settled

| Call              | Question                                                             | Won                                                                                                 | Lost                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 9 · attachment    | How does the sub-navigation attach to the floating header?           | A · second row inside the header card                                                               | B · attached pill below; C · full-width band                                                                                                  |
| 10 · crowded row  | What does the row hold when seven destinations do not fit?           | B · the live stage leads                                                                            | A · one map control; C · pinned live with the strip below                                                                                     |
| 11 · open map     | What opens when the row is used?                                     | A · one mega panel, reusing the shipped hover panel and the drill-in drawer                         | B · two anchored menus; C · spotlight leads the panel                                                                                         |
| 12 · long names   | How does the row carry a 44-character name with no icon asset?       | A · two lines, one control (on the phone)                                                           | B · live only, name in the page; C · the banner is the mark                                                                                   |
| 13 · desktop row  | What does the desktop row do with the width the phone does not need? | C · the pages inline, both controls right                                                           | A · one line, status inline; B · name left, controls right                                                                                    |
| 14 · active state | How does the row mark the page you are on?                           | B · theme pill                                                                                      | A · connected tab; C · weight and a dot                                                                                                       |
| 15 · control jobs | What does each control on the right do?                              | C · no competition button: every page in the strip, an overflow menu, the stages on a split control | A · live is a link; B · live is a split button beside the competition menu                                                                    |
| 16 · name width   | How does the row carry a 72-character competition name?              | nothing: all three rejected                                                                         | A · the short name, a field that does not exist; B · cap it; C · B plus a slot                                                                |
| 17 · phone row    | What does the phone row carry, now that the name is not its job?     | nothing: all three rejected                                                                         | A · one control, the live stage; B · the page and the stage; C · the pages scroll, the stages are an icon                                     |
| 18 · two lines    | What do the call 12 two lines say without the name?                  | nothing: all three rejected                                                                         | A · the page, then the stage; B · the stage, then the pages; C · one line, the control names the page                                         |
| 19 · map control  | How does the control that opens the full map sit in the row?         | E · a chip and a square, two bounded targets with a gap                                             | A · the whole row is the control; B · a bare icon; C · the right edge of the bar; D · two zones, one seam; F · the map joins the header icons |
| 20 · long stage   | What does the chip do with a stage name it cannot fit?               | B · drop "is live now" before the name is cut                                                       | A · truncate the name inside the chip; C · wrap the chip to two lines                                                                         |
| 21 · alignment    | What do the chip and the square line up with in the header above?    | A · the boxes line up, on the header's 16px gutter                                                  | B · the ink lines up, breaking the gutter; C · the row keeps its own 24px gutter                                                              |
| 22 · other states | What does the chip carry when no stage is live?                      | A · the nearest stage, forward or backward                                                          | B · the chip is only ever a live stage; C · the chip states the competition                                                                   |
| 23 · missing date | What does the chip read when the stage has no date it can show?      | A · keep the verb, drop the time                                                                    | B · the name alone; C · say the date is missing                                                                                               |

Calls 1 to 8 ran before the drawing tool dropped Angular. Their sketches no longer render; call 8
`call.ts` still records what each round ruled.

Standing decisions:

- The global header stays the source implementation. The competition row never replaces it.
- The row splits today's strip into what it really is: three pages about the competition, and the
  stage children, which carry `executionStatus`.
- No "you are on X" label, and no "Overview · 5 more pages" line either: no product writes that.
- A stage carries one name. `Group Stage · Week 4` was invented; the row states the child stage name,
  whatever it is.
- The row carries no count badge.
- The shipped Overview/Tournament tabs are the navigation this redesign replaces, so no drawing shows
  them.
- The control opens a full-page panel that the bar morphs into, holding everything the competition has.
- The competition part of the bar wears a subtle competition theme gradient.

## Open

- **The hover-to-open morph.** How the competition button grows into the mega panel, on desktop
  hover and on a phone tap.

- **The competition name as a link to Overview.** It would make the row's first word clickable, but
  the active mark would then run the whole length of a 44-character name.

- **The desktop row, once the phone is settled.** Calls 9 to 16 designed at 1400px first. Call 17
  restarts at 390px, and the desktop row has to follow whatever the phone settles.

Calls 17 and 18 are rejected whole. Both still carried a strip of pages beside the stage; call 19
settled the row into one stage and one map control instead.

Call 20 ruled that the dot carries the live state on its own, so the verb is what the chip gives up
first. The name is cut only after the verb is gone.

Call 21 ruled that a filled shape aligns by its edge. The chip and the square sit on the header's own
16px gutter, and the 13px the chip's padding adds is accepted.

Call 22 ruled the chip names the nearest stage in every state: the next one starts, the last one
ended. Only the announced competition, which has no stage at all, drops the chip. The user added a
constraint with the ruling: `scheduledAt` is often missing or holds a value that cannot be shown, so
the chip has to read without a time.

Call 23 ruled the chip keeps a word that places the stage in time, and drops only the time itself.
"next" is accepted. "ended" is not: the user called the word wrong, so call 24 asks what a stage
that is over reads instead.

Every row drawing from call 24 on carries two strips it is easy to forget: the live state, which is
the reference every other state is judged against, and an overflow state with a stage name the chip
cannot fit.
