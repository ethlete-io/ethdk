# Bracket compute core

`@ethlete/bracket` is the framework-free compute layer behind
[`@ethlete/components` bracket UI](/components/bracket). It links a `BracketDataSource`, preserves
slot provenance, resolves the participants produced by a viewer's predictions, builds grids and
connector paths, selects registered layouts, and exposes the grid's natural width without importing
Angular or `@ethlete/core`.

```bash
yarn add @ethlete/bracket
```

## Link a source

```ts
import { createBracket } from '@ethlete/bracket';

const bracket = createBracket(source, { layout: 'left-to-right' });
```

When slots carry `homeSource` / `awaySource`, `createBracket` uses their `match-outcome` references
as the relation graph. For a source that keeps graph metadata elsewhere, supply it directly:

```ts
const bracket = createBracket(source, {
  layout: 'left-to-right',
  previousMatchIds: (match) => graph[match.id] ?? [],
});
```

Sources without either form keep the legacy positional relation behavior.

Grid builders return a `ComputedBracketGrid`; use `bracketGridNaturalWidth(grid)` before rendering to
size or scroll a framework-specific host. `resolveBracketLayout(layouts, mode)` provides the same
first-match registry behavior without depending on Angular layout types.

## Resolve predictions

```ts
import { resolveBracketSlot } from '@ethlete/bracket';

const participantId = resolveBracketSlot({
  bracket,
  matchId: 'final',
  side: 'home',
  picks: {
    matchWinner: (matchId) => winnerPicks[matchId] ?? null,
    standingRank: ({ standingId, rank }) => standingPicks[standingId]?.[rank] ?? null,
  },
});
```

The resolver follows winner and loser paths recursively. A bye advances the other side without a
pick. Missing picks, invalid references, and cycles return `null`. Real match outcomes do not replace
the viewer's chain; deciding whether a prediction scored correctly remains application logic.

`isBracketSlotPredictable(source)` distinguishes pick-driven sources from `bye`, `external`, and
undrawn `swiss-bucket` slots.

## Angular rendering

Install `@ethlete/components` when the app can use the SDK's Angular version. It re-exports the public
model and adds `<et-bracket>`, `<et-bracket-pick-card>`, Angular layout factories, theming, and
responsive round focus. See the [complete bracket guide](/components/bracket).
