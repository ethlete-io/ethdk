# Standings pick

A group table a viewer predicts the order of: the participants as a list of cards, reorderable by drag
and by keyboard, with a cut line where the advancing places end. The read-only counterpart is the
[standings table](/components/standings); the knockout counterpart is
[bracket prediction](/components/bracket-prediction).

Import `STANDINGS_PICK_IMPORTS`. No provider is required; `provideStandingsLabels()` localizes the
strings (the same label set the standings table uses).

```html
<et-standings-pick [(order)]="order" [participants]="teams()" [advancingCount]="2" />
```

```ts
import { STANDINGS_PICK_IMPORTS } from '@ethlete/components';

@Component({ imports: [STANDINGS_PICK_IMPORTS] })
export class GroupPicksComponent {
  protected teams = computed(() => this.query.response()?.participants.map(toParticipant) ?? []);

  /** Bound two-way, so this is the order a save sends. */
  protected order = signal<readonly string[] | null>(null);
}
```

## Live demo

<StoryEmbed id="components-sports-standings-pick--default" height="420px" />

## Options

| Input            | Type                                    | Default | What it does                                                                                     |
| ---------------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `participants`   | `readonly NormalizedMatchParticipant[]` | -       | Required. The group's participants, in the order the backend listed them.                        |
| `storedPicks`    | `readonly StandingPick[]`               | `[]`    | Predictions already stored, by position. Decides the order the list opens in.                    |
| `advancingCount` | `number`                                | `0`     | How many positions advance. The cut is drawn after the last of them; `0` draws none.             |
| `locked`         | `boolean`                               | `false` | Refuses every move and removes the row controls. The order stays readable.                       |
| `order`          | `readonly string[] \| null`             | `null`  | Two-way. The order on screen, as participant ids. `null` follows `participants` + `storedPicks`. |
| `labels`         | `Partial<StandingsLabels> \| null`      | `null`  | Per-instance string overrides.                                                                   |

`participant` is the same [normalized participant](/components/match#any-backend-the-normalized-match)
the match card and the standings table take, so one adapter feeds all three.

## Where the order starts

Leave `order` unbound (or `null`) and the list opens in the order `standingPickStartOrder()` produces:
**every stored pick takes the position it was stored on, and the participants without one follow in
the order the backend listed them, filling the gaps.** So a partly handed-in group opens with the
handed-in places where the viewer put them and the rest behind, rather than resetting to the API's
order.

```ts
import { standingPickStartOrder } from '@ethlete/bracket';

standingPickStartOrder({
  participantIds: ['a', 'b', 'c', 'd'],
  picks: [{ position: 3, participantId: 'a' }],
}); // ['b', 'c', 'a', 'd']
```

A pick the field cannot hold is dropped rather than drawn - a position outside the field, an id nobody
answers to, a second pick for a position or for a participant already placed (the lowest position
keeps it). The result is always a permutation of `participantIds`, so the drawn list can never gain or
lose a row.

Bind `[(order)]` when the order is yours to keep: a draft to submit, a reset button, an order restored
from somewhere else. The component writes back on every move.

## Moving a row

`move({ from, to })` on the headless directive is the single entry point - the drag and the arrow keys
both go through it, so a keyboard reaches every order a pointer does.

An index outside the list **does nothing rather than clamping.** ArrowUp on the first row and
ArrowDown on the last leave the order exactly as it was; clamping would move the row somewhere the
viewer did not ask for. A `locked` list refuses every move.

## Locked

Once a group is over the order must stay legible but stop being editable. `locked` removes the row
controls (so there is nothing to focus and nothing to grab), dims the cards, and sets `data-locked` on
the host for your own styling.

<StoryEmbed id="components-sports-standings-pick--locked" height="420px" />

## The score mark is yours

Whether a pick was right is your data, so the component draws nothing in the row's trailing slot until
you fill it:

```html
<et-standings-pick [participants]="teams()" [storedPicks]="picks()" [advancingCount]="2" locked>
  <ng-template let-row etStandingsPickMark>
    <span>{{ pointsOf(row.participant.id) }}</span>
  </ng-template>
</et-standings-pick>
```

The template context is `$implicit: StandingsPickRow` (`participant`, `position`, `isAdvancing`,
`isLastAdvancing`) plus `index`. One template per list - a second one throws `ET4401`.

### Scoring an order

`@ethlete/bracket` scores one position and stops there:

```ts
import { standingPickOutcome } from '@ethlete/bracket';

standingPickOutcome({ predictedPosition: 1, actualPosition: 1, advancingCount: 2 }); // 'exact'
standingPickOutcome({ predictedPosition: 1, actualPosition: 2, advancingCount: 2 }); // 'partial'
standingPickOutcome({ predictedPosition: 2, actualPosition: 3, advancingCount: 2 }); // 'wrong'
```

| Outcome   | When                                                           |
| --------- | -------------------------------------------------------------- |
| `exact`   | The participant finished on exactly the predicted position.    |
| `partial` | The predicted side of the advancing line, on another position. |
| `wrong`   | The other side of the line, whatever the distance.             |

**It returns an outcome and never a number of points.** What an outcome is worth is a rule of the
competition, usually enforced server-side, so the arithmetic stays in your app:

```ts
const POINTS: Record<StandingPickOutcome, number> = { exact: 5, partial: 3, wrong: 0 };
```

`exact` is awarded **below** the line as well. If your API stores only the advancing positions then
you hold no prediction for the rest - the order down there is whatever your UI happened to draw - so
narrow those rows to `partial`/`wrong` yourself before showing a score.

## Building your own list

`etStandingsPick` is the headless tier: it owns the order, the start order, the cut and `move()`, and
imposes no markup. Use it when the cards need a layout of their own (a two-column group, a grid of
crests); the drawn `et-standings-pick` reads exactly the same state.

```html
<ul #pick="etStandingsPick" [participants]="teams()" [advancingCount]="2" etStandingsPick>
  @for (row of pick.rows(); track row.participant.id; let i = $index) {
  <li>{{ row.position }} - {{ row.participant.name }}</li>
  }
</ul>
```

## Accessibility

The list is an `<ol>` named by the `pickCaption` label, one `<li>` per participant.

Every row carries **one** control and it does both jobs - it is the drag grip and the arrow-key
target. It is named `Move <participant>. Drag it, or use the arrow keys.` (the `pickMoveRow` label),
so a screen-reader user is told both ways to sort from the control itself.

| Key                  | Action                                                  |
| -------------------- | ------------------------------------------------------- |
| <kbd>Tab</kbd>       | Moves to the next row's control.                        |
| <kbd>ArrowUp</kbd>   | Moves the row up one position. No-op on the first row.  |
| <kbd>ArrowDown</kbd> | Moves the row down one position. No-op on the last row. |

Focus stays on the control of the row it moved, so repeated presses carry one row through the list.
Both keys call `preventDefault()`, so the page does not scroll under the reorder.

The cut line is `aria-hidden` - it is a drawn line with the `pickCut` label on it, and a reader going
row by row would never reach it. Every row above it instead carries a visually hidden
`pickAdvancingRow` note, and a locked list carries a hidden `pickLocked` note, so neither fact is
colour- or position-only.

## Theming

Every colour resolves from the app-registered [surface and colour theme](/core/theming) systems - the
card fills and the handle states from `--et-surface-interaction-solid`, the text from
`--et-surface-color-*`, the cut line from `--et-theme-color-primary-solid`. Scope the list with
`[etProvideColor]` to change what the cut is drawn in; no theme name is baked in.

| Token                                  | Default | What it sizes                         |
| -------------------------------------- | ------- | ------------------------------------- |
| `--et-standings-pick-row-height`       | `40px`  | One row's height.                     |
| `--et-standings-pick-gap`              | `4px`   | Gap between rows and inside a card.   |
| `--et-standings-pick-radius`           | `8px`   | Card corner radius.                   |
| `--et-standings-pick-font-size`        | `13px`  | Row text size.                        |
| `--et-standings-pick-preview-duration` | `180ms` | How long a card slides during a drag. |

The drag preview honours `prefers-reduced-motion: reduce` by not animating.

## Error codes

The standings domain throws `ET44xx` - see
[/components/error-codes#standings-et44xx](/components/error-codes#standings-et44xx).
