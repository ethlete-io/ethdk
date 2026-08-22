# Match

A match card and the participant primitive it is built from - the two pieces every sport and esport UI repeats:
a fixture list, a results table, a [bracket](/components/bracket) cell, a
["today's matches" rail](/components/sport-recipes#today-s-matches-rail). The card draws
both sides with their emblems, the score or the kick-off, a live badge, the per-game breakdown of a series, and
the winner emphasized once there is one.

Import `MATCH_CARD_IMPORTS` (or `MATCH_PARTICIPANT_IMPORTS` for the primitive alone). No provider is required;
`provideMatchLabels()` localizes the strings and `provideDateLocale()` the kick-off.

```html
<a [match]="match()" [routerLink]="['/matches', match().id]" et-match-card></a>
```

```ts
import { MATCH_CARD_IMPORTS, normalizeEthleteMatch } from '@ethlete/components';

@Component({ imports: [MATCH_CARD_IMPORTS, RouterLink] })
export class MatchListComponent {
  private query = matchListQuery.prepare(); // your own query
  protected matches = computed(() => this.query.response()?.items.map(normalizeEthleteMatch) ?? []);
}
```

## Live demo

<StoryEmbed id="components-sports-match--default" height="420px" />

## Any backend: the normalized match

The card never learns one API's field names. It takes a `NormalizedMatch` - a small, presentation-oriented
view-model owned by this library - and an **adapter** maps whatever your backend returns into it:

```ts
type NormalizedMatch = {
  id: string;
  status: 'scheduled' | 'live' | 'finished';
  startTime: Date | null; // null = unscheduled
  home: NormalizedMatchParticipant | null; // null = a TBD slot
  away: NormalizedMatchParticipant | null;
  homeScore: number | string | null; // the headline value; null = none yet
  awayScore: number | string | null;
  resultKind: 'score' | 'points' | 'outcome'; // what those two values are, or ignored for 'outcome'
  gameScores: { home: number; away: number }[] | null; // Bo3/Bo5/Bo7 games; null = single game
  winnerSide: 'home' | 'away' | null;
  label: string | null; // "Match 3", "Grand Final"
};

type NormalizedMatchParticipant = {
  id: string;
  name: string | null; // team name, gamertag
  code: string | null; // short code for compact rendering ("FCB")
  subtitle: string | null; // the org behind the roster, the club behind the squad
  emblem: { sources?: (PictureSource | string)[]; defaultSrc?: PictureSource | string | null } | null;
  seed: number | null;
};
```

`NormalizedMedia` is deliberately exactly [`et-picture`](/components/picture)'s two inputs, so an emblem is
passed straight through - including a full `srcset` candidate set if your API has one.

### Adapters are plain functions

For an `@ethlete/types` backend, the adapter ships with the library:

| Export                                | Maps                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `normalizeEthleteMatch(match)`        | `MatchListView` / `DetailedMatchListView` → `NormalizedMatch` |
| `normalizeEthleteParticipant(p)`      | `ParticipantViewUnion` → `NormalizedMatchParticipant`         |
| `normalizeEthleteMedia(media)`        | `MediaView` → `NormalizedMedia`                               |
| `normalizeEthleteMatchStatus(status)` | `MatchStatus` → the three states                              |

The smaller mappers are exported too, so a partial shape can reuse one without the whole match adapter. Any
other backend writes its own `(data) => NormalizedMatch` - no DI, no registration.

Two mapping decisions worth knowing about: a player's `gamertag` beats the account `name` (it is what people
know them by), and the five API statuses collapse to three - `started` is live, `finished`/`published` are both
over, everything else (including `hidden`) reads as scheduled rather than throwing inside a list. `seed` and
`subtitle` come out `null`: neither is in the list views, and both are easy to fill in after normalizing.

### What goes in the result slot

Not always a score, and this is the part most likely to bite. A competition reports its results in exactly
**one** of three forms, and `resultKind` says which - never two of them at once, because a cell showing `2`
next to `W` says the same thing twice:

| `resultKind` | Draws           | From                          | Announced as      |
| ------------ | --------------- | ----------------------------- | ----------------- |
| `'score'`    | `2` / `1`       | `homeScore` / `awayScore`     | `"2 : 1"`         |
| `'points'`   | `3` / `0`       | the same two fields           | `"3 : 0 points"`  |
| `'outcome'`  | `W` / `L` / `D` | **derived from `winnerSide`** | `"FC Berlin won"` |

```ts
// a knockout that only reports who advanced
{ ...match, resultKind: 'outcome', homeScore: null, awayScore: null, winnerSide: 'home' }
```

<StoryEmbed id="components-sports-match--outcome" height="360px" />

`'outcome'` deriving its letters is what keeps the model honest: `winnerSide` already says who won, so nothing
has to denormalize that into two strings - and a screen reader hears "FC Berlin won" rather than the letter
"W". The letters only appear once the match is finished; before that the kick-off carries the card.

For `'score'`, a single-game match's headline value _is_ that game's score, which is why `gameScores` stays
`null` there rather than listing one game. A best-of-N puts its games in `gameScores` - up to seven for a Bo7 -
and the headline values are then the games each side won.

## Four layouts, one component

The card measures **itself** with a container query, and the same DOM lands on one of four layouts:

| Width     | Layout                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------- |
| < 150px   | **Minimal** - below the dense row: emblems drop entirely, leaving a code and a score                    |
| 150–319px | **Dense row** - a bracket column or a results list: small emblems, no subtitles, no game breakdown      |
| 320–559px | **Featured card** - bigger emblems and score, participant subtitles, the per-game breakdown of a series |
| ≥ 560px   | **Wide row** - the two sides stop stacking and face each other, results meeting in the middle           |

There is nothing to configure and no breakpoint to keep in sync with a layout.

The dense row is deliberately stripped: a bracket cell's round is named by the column it sits in, and its
kick-off by the list around it, so repeating either inside every cell is noise. A **live badge is the one
exception** - it is the reason someone is looking at the card. For the densest cell there is, `hideNames`
drops the names too, leaving emblems and results.

<StoryEmbed id="components-sports-match--states" height="640px" />

`size` pins one when you want the same card everywhere regardless of width:

| `size`       | Renders                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `'auto'`     | Container query decides (the default)                                    |
| `'compact'`  | Always the dense row, **and** participant names become their short codes |
| `'expanded'` | Always the featured card                                                 |
| `'wide'`     | Always the wide row                                                      |

::: tip Only an explicit `compact` swaps names for codes
Swapping "Neon Esports" for "NEO" is a text change, and a container query can only change styles. So `auto`
keeps full names and lets them ellipsize; a bracket cell that wants codes sets `size="compact"`.
:::

The wide row is pure CSS over the same markup - the away side is mirrored with `row-reverse`, which is also why
it keeps working in RTL - so nothing re-renders when the card crosses a threshold.

The thresholds are constants rather than tokens, because a `@container` condition may not contain
`var()` - there is nothing a custom property could point at. Tune the layouts through their tokens
instead (see [Theming](#theming)), or pin one with `size`.

Because the card is a container, its own width can never come from its contents. In a block or grid parent that
is exactly right; in a flex row with no width it would collapse, which is what
`--et-match-card-min-inline-size` (180px) guards against.

## Live scores

A live match's values roll when they change: the old value leaves upward as the new one arrives from
below, with a brief flash behind the side that scored. Both values are **real elements** for the length of
the roll - this library never clones a node to animate it - and the outgoing one is dropped on its own
`animationend`, so nothing is left running.

<StoryEmbed id="components-sports-match--live" height="420px" />

The card is **dumb about transport**: it compares the values it is given against the ones it had. Point
[`@ethlete/query`](/query/) polling or a socket at the `match` input and the rest follows.

| Behaviour                     | Rule                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ |
| First render                  | Never animates - a list arriving with scores on it hasn't seen anything happen |
| `status` other than `'live'`  | Never animates; a finished result arriving with the page is not a moment       |
| `animateScoreChanges` `false` | No movement, everything else unchanged                                         |
| `prefers-reduced-motion`      | Instant swap, no flash                                                         |

`scoreChange` fires with the side, both values and the numeric `delta` - the hook for the effects the card
deliberately doesn't ship:

```html
<et-match-card [match]="match()" (scoreChange)="onGoal($event)" />
```

```ts
protected onGoal(change: MatchScoreChange) {
  if (change.side === 'home') this.crowdNoise.play();
}
```

It fires on **any** change after the first render, live or not - a corrected result is still a change your
app may want to know about. Only the animation is gated to live.

## The card is the link

In a real app a match card is almost always a click target. Rather than owning that, the card puts its whole
accessible name on its **host element** - so making the host the link is all it takes:

```html
<!-- router navigation -->
<a [match]="match()" [routerLink]="['/matches', match().id]" et-match-card></a>

<!-- a shareable detail overlay, via a query-param overlay -->
<a
  [match]="match()"
  [etQueryParamOverlayLink]="matchOverlay"
  [etQueryParamOverlayLinkValue]="match().id"
  et-match-card
></a>

<!-- non-interactive, e.g. a results table -->
<et-match-card [match]="match()" />
```

See [overlay openers](/components/overlay-openers) for the overlay half of that.

::: warning One interactive element, no exceptions
Nothing inside the default card is a click target - scores, emblems and participants are display only. A card
that contains a second link or button is a card whose hit areas fight each other, and whose accessible name is
no longer the match. An affordance that needs its own interactivity (a pin, a follow button) goes **next to**
the card, not inside it.
:::

A card on an `<a>` or `<button>` detects that itself. For a host that is interactive some other way - a `<div>`
wired to an [overlay opener](/components/overlay-openers) with its own `role` and `tabindex` - set
`interactive` explicitly so the hover and focus treatment applies.

## Options

`et-match-card` (element or attribute, `[et-match-card]`):

| Input             | Type                                             | Default  | What it does                                                                                           |
| ----------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `match`           | `NormalizedMatch`                                | -        | Required. The match to draw.                                                                           |
| `size`            | `'auto' \| 'compact' \| 'expanded' \| 'wide'`    | `'auto'` | Layout; see above.                                                                                     |
| `showSeeds`       | `boolean`                                        | `false`  | Draw each participant's seeding position when they have one.                                           |
| `startTimeFormat` | `string \| null`                                 | `null`   | date-fns format for the kick-off. `null` uses `'P p'` - a rail of today's matches usually wants `'p'`. |
| `interactive`     | `boolean \| null`                                | `null`   | `null` infers it from the host tag (`<a>` / `<button>`).                                               |
| `labels`          | `Partial<MatchLabels> \| null`                   | `null`   | Per-instance string overrides.                                                                         |
| `liveColor`       | `RegisteredColorThemeName \| ColorTheme \| null` | `null`   | The live badge's color theme. `null` uses the app's `type: 'error'` theme.                             |

The kick-off is formatted with [date-fns](https://date-fns.org/docs/format) in the app's `DATE_LOCALE` - an app
that calls `provideLocale('de')` should call `provideDateLocale(de)` next to it, or dates stay en-US.

## Participants on their own

`<et-match-participant>` is the same primitive the card draws with - emblem, name and optional seed - and is
worth reaching for in a roster, a standings cell or a filter chip's content:

```html
<et-match-participant [participant]="player()" showSeed />
```

**It takes an attribute form too**, so the whole thing can be one click target - a player card that opens a
profile, a team row that filters a list:

```html
<a [participant]="player()" [routerLink]="['/players', player().id]" et-match-participant showSeed></a>
```

It detects an `<a>` or `<button>` host itself: the host is then named after the participant (without that, the
link reads "FC Berlin emblem FC Berlin"), takes the shared [focus ring](/components/focus-ring), underlines
its name on hover, and loses the button chrome. `interactive` forces it for a host that is a click target some
other way.

| Input         | Type                                 | Default | What it does                                                          |
| ------------- | ------------------------------------ | ------- | --------------------------------------------------------------------- |
| `participant` | `NormalizedMatchParticipant \| null` | `null`  | `null` renders the `tbd` label against an empty emblem frame.         |
| `compact`     | `boolean`                            | `false` | Prefer the short `code` over the full name, and drop the subtitle.    |
| `showSeed`    | `boolean`                            | `false` | Show the seeding position beside the name.                            |
| `loading`     | `boolean`                            | `false` | Draw [skeleton](/components/skeleton) bones instead of an empty slot. |
| `interactive` | `boolean \| null`                    | `null`  | `null` infers it from the host tag (`<a>` / `<button>`).              |
| `labels`      | `Partial<MatchLabels> \| null`       | `null`  | Per-instance string overrides.                                        |

`loading` and a `null` participant are different states on purpose: a `null` participant is a decided
**absence** - a bracket match whose feeder hasn't finished - and renders "TBD" at full row height, so nothing
jumps when the name arrives. `loading` is a pending one.

A participant's `subtitle` renders as a quieter second line under the name - the org behind an esports roster,
the club behind a squad. It is dropped in a dense row (and by `compact`), where a second line would double
every row's height.

`matchParticipantDisplayName({ participant, labels, compact })` is exported as well: it is the fallback chain
(name → code → `tbd`, reversed for compact) that both the primitive and the card's accessible name use, and it
is the right thing to call when you compose a name of your own.

## Localization

Every string comes from one label set, app-wide via `provideMatchLabels()` or per instance via `labels`.
Partial - whatever you leave out keeps its English default.

```ts
provideMatchLabels({
  tbd: 'Offen',
  live: 'Live',
  matchName: ({ home, away, result }) => `${home} gegen ${away}${result ? `, ${result}` : ''}`,
});
```

| Label            | Default                     | Where it shows                                             |
| ---------------- | --------------------------- | ---------------------------------------------------------- |
| `tbd`            | `'TBD'`                     | An undecided participant slot                              |
| `live`           | `'Live'`                    | The live badge                                             |
| `finished`       | `'Finished'`                | The finished state, where a status word is drawn           |
| `scheduled`      | `'Scheduled'`               | The not-started state                                      |
| `scoreSeparator` | `' : '`                     | Between the two scores, in the card name and the breakdown |
| `versus`         | `'vs'`                      | Between the two sides in the wide row, before a result     |
| `outcomeWin`     | `'W'`                       | The winning side's letter, for `resultKind: 'outcome'`     |
| `outcomeLoss`    | `'L'`                       | The losing side's letter                                   |
| `outcomeDraw`    | `'D'`                       | Both sides' letter for a draw                              |
| `emblemAlt`      | `(p) => '<p> emblem'`       | The emblem image's alt text                                |
| `seed`           | `(n) => 'Seed <n>'`         | The seed badge's accessible label                          |
| `gameScores`     | `'Games'`                   | Names the per-game breakdown                               |
| `gameScore`      | `(n, s) => 'Game <n>: <s>'` | One game of a series                                       |
| `resultName`     | see below                   | How the result is announced                                |
| `matchName`      | see below                   | The card's whole accessible name                           |

Two of them do the composing, and they are where you change phrasing rather than words:

- **`resultName({ home, away, kind, winner, separator })`** turns the result into the phrase the card
  announces - which is not what it draws. With values it reads `"2 : 1"` (or `"3 : 0 points"`); with none it
  names the winner, `"FC Berlin won"`, or says `"Draw"`.
- **`matchName({ home, away, result, resultKind, winner, startTime, status, label })`** composes the card's
  whole accessible name, taking `resultName`'s output as `result`. The default reads
  `"Grand Final: FC Berlin vs. Neon Esports, 2 : 1, Finished"` - which match, who is playing, how it stands,
  whether it is still going.

## Build your own card

The headless tier is `[etMatchCard]`: all the derived state, none of the layout. Put it on the element that is
the card and read the state off it.

```html
<a #card="etMatchCard" [match]="match()" [routerLink]="['/matches', match().id]" etMatchCard>
  <span etMatchCardMeta>{{ card.formattedStartTime() }}</span>
  <span>{{ card.homeName() }}</span>
  <span>{{ card.awayName() }}</span>
  <span etMatchCardScore>{{ card.result() }}</span>
</a>
```

| Member                                        | Type                            | What it is                                                |
| --------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `resolvedLabels()`                            | `MatchLabels`                   | Injected labels with this instance's `labels` applied     |
| `homeName()` / `awayName()`                   | `string`                        | Display names, full even where the card draws codes       |
| `result()`                                    | `string \| null`                | The announced phrase: `'2 : 1'`, `'FC Berlin won'`        |
| `drawsScore()` / `drawsOutcome()`             | `boolean`                       | Which result form this card is drawing (never both)       |
| `homeOutcome()` / `awayOutcome()`             | `string \| null`                | The W/L/D letters, for `resultKind: 'outcome'`            |
| `winnerName()`                                | `string \| null`                | The winning side's display name                           |
| `separatorText()`                             | `string`                        | What goes between the sides in the wide row               |
| `gameScores()`                                | `NormalizedGameScore[] \| null` | The series breakdown                                      |
| `gameScoreText(gameScore)`                    | `string`                        | One game in the same `'13 : 11'` shape                    |
| `formattedStartTime()`                        | `string \| null`                | Kick-off in the active locale                             |
| `accessibleName()`                            | `string`                        | The composed name (also bound to the host's `aria-label`) |
| `isLive()` / `isFinished()` / `isScheduled()` | `boolean`                       | The status, as three predicates                           |
| `showsShortNames()`                           | `boolean`                       | Whether participants render as codes                      |
| `isInteractive()`                             | `boolean`                       | Whether the card is a click target                        |

The host also carries `data-status`, `data-size`, `data-result-kind`, `data-winner`, `data-interactive` and
`data-hide-names` - the layout rules are written against those, so your own can be too.

Three optional parts wire the accessibility that is easy to get wrong:

| Part                    | What it does                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `etMatchCardScore`      | Makes the element a polite, atomic live region, so a score arriving over a poll or socket is announced once as `"2 : 1"` |
| `etMatchCardMeta`       | Hides the label/badge/kick-off row from assistive tech - all three are already in the composed name                      |
| `etMatchCardGameScores` | Names the breakdown from the `gameScores` label and gives it an explicit `role="list"`                                   |

Each throws [`ET4300`](/components/error-codes#match-et43xx) in dev mode when used outside an `[etMatchCard]`.

## Accessibility

- **One name per card.** The composed `matchName` lands on the host as `aria-label`, so a screen reader reads
  the match rather than walking six unrelated fragments. A card that is not a link becomes `role="group"` (an
  unlabelled `div` cannot carry a name); a card on an `<a>` or `<button>` keeps its native role.
- **Score changes are announced once.** The result sits in a visually hidden, polite, atomic live region that is
  in the DOM from the start - a region added at the same moment as its value announces nothing. The drawn
  digits and outcome letters are `aria-hidden`, so a goal is read as `"3 : 1"` and not three times over.
- **Outcomes are phrased, not spelled.** `resultKind: 'outcome'` draws `W` / `L`; what gets announced is
  `"FC Berlin won"`, because the letters carry no meaning read aloud.
- **Nothing a layout hides is lost.** The dense row drops the label, kick-off and subtitles from the _drawing_
  only; all of them are still in the card's composed name, which is what a screen reader reads. Same for
  `hideNames`.
- **The meta row is hidden** (`aria-hidden`) because the label, live badge and kick-off are all in the card's
  name already.
- **The series breakdown stays exposed**, as a real list, with each game numbered (`"Game 2: 8 : 13"`) - a bare
  `"8 : 13"` says nothing on its own.
- **Emblems** are named from `emblemAlt`, and a seed badge from `seed`, since the digit alone is meaningless.
- **Keyboard**: a card on an `<a>`/`<button>` is focusable and activatable natively, and shows the shared
  [focus ring](/components/focus-ring). The card adds no key handling of its own - there is nothing inside it
  to move focus between.
- **Reduced motion**: the live badge's pulse stops under `prefers-reduced-motion: reduce`, and a score
  change swaps instantly instead of rolling.

## Theming

Colors come entirely from the app-registered [surface and color theme](/core/theming) systems: surface tokens
for the card's background, border and text, and the **color theme in scope** for the live badge - which the
component points at the app's `type: 'error'` theme by default, so it is red without this library naming a
theme. Override it per card with `liveColor`, or leave it unset in an app that registers no error theme and the
badge follows the ambient color scope.

The winning side's accent bar uses `--et-theme-color-primary-solid` from the color scope the card sits in, so a
bracket in a branded scope marks its winners in that brand's accent.

Sizing is one token per layout, so a value you set survives the container query switching modes. The wide row
reuses the featured card's tokens and changes only the arrangement:

| Token                                      | Default | What it sets                                              |
| ------------------------------------------ | ------- | --------------------------------------------------------- |
| `--et-match-card-border-radius`            | `10px`  | The card's corner radius                                  |
| `--et-match-card-min-inline-size`          | `180px` | The floor that keeps a card in a flex row from collapsing |
| `--et-match-card-compact-padding`          | `10px`  | Padding, dense row                                        |
| `--et-match-card-expanded-padding`         | `16px`  | Padding, featured card                                    |
| `--et-match-card-compact-gap`              | `6px`   | Row gap, dense row                                        |
| `--et-match-card-expanded-gap`             | `12px`  | Row gap, featured card                                    |
| `--et-match-card-compact-emblem-size`      | `20px`  | Emblem size, dense row                                    |
| `--et-match-card-expanded-emblem-size`     | `36px`  | Emblem size, featured card                                |
| `--et-match-card-compact-name-font-size`   | `13px`  | Participant name size, dense row                          |
| `--et-match-card-expanded-name-font-size`  | `15px`  | Participant name size, featured card                      |
| `--et-match-card-compact-score-font-size`  | `14px`  | Score size, dense row                                     |
| `--et-match-card-expanded-score-font-size` | `20px`  | Score size, featured card and wide row                    |
| `--et-match-card-minimal-padding`          | `6px`   | Padding, minimal layout                                   |
| `--et-match-card-minimal-gap`              | `3px`   | Row gap, minimal layout                                   |
| `--et-match-card-minimal-name-font-size`   | `11px`  | Participant name size, minimal layout                     |
| `--et-match-card-minimal-score-font-size`  | `12px`  | Score size, minimal layout                                |

The participant primitive has its own three, which apply wherever it is used standalone:

| Token                                | Default | What it sets       |
| ------------------------------------ | ------- | ------------------ |
| `--et-match-participant-emblem-size` | `28px`  | The emblem frame   |
| `--et-match-participant-gap`         | `10px`  | Emblem-to-name gap |
| `--et-match-participant-font-size`   | `14px`  | The name           |

Inside a card those three are driven by the card's own density tokens, so set the card's when theming a card.

## Error codes

The match domain owns `ET4300`–`ET4399` - see
[error codes](/components/error-codes#match-et43xx).
