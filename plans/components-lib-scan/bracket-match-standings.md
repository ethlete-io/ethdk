# bracket, match, standings (components) scan - open findings

Scan of `libs/components/src/lib/bracket/`, `libs/components/src/lib/match/`, `libs/components/src/lib/standings/` from 2026-09-28. 0 High, 2 Medium, 6 Low, 2 Spec (verified: 9 confirmed, 3 re-rated, 0 refuted, 1 unverified). Skipped: specs, stories, `testing/` drivers, most CSS (checked for `@layer`, colours and Tailwind only). The framework-free model in `libs/bracket` is out of scope.

## bracket: grid and journey highlight

## bracket: bundle size

- Medium: `resolveBracketComponents` imports all four default cards statically (`bracket/bracket-components.ts:10-13`). Every `et-bracket` consumer, and even the pure `bracketNaturalWidth` helper (`bracket/bracket-fits-width.ts:37`), bundles the final card with its icons, the match card and date-fns `format`, including an app that supplies its own cards. Let the width helper skip component resolution, and move the defaults behind the layout factories or the config. M Verified.
- Low: `BRACKET_IMPORTS` puts `BracketComponent`, `BracketParticipantsComponent` (and with it `ButtonComponent`), `BracketPickCardComponent` and `BracketRoundsListComponent` in one tuple (`bracket/bracket.imports.ts:6-11`). An app that renders only `et-bracket` bundles all four. Split into per-component import tuples. S Re-rated from Medium: each component is also exported on its own, and the `*_IMPORTS` tuple is the repo-wide convention.

## bracket: rounds list and cards

- Low: `sectionHeadingLevel` equals the round header level when `roundHeaderLevel` is 1 (`bracket/bracket-rounds-list.component.ts:151`). Decision: clamp `roundHeaderLevel` to 2+ in a sectioned list, or accept the flat outline. S

## bracket: Ethlete integration

- Medium: swiss detection throws `MODE_UNSUPPORTED` when the last round has as many matches as the first drawn round (`bracket/integrations/ethlete.ts:100-114`). If the API returns only the rounds drawn so far, a 16-team swiss stage fails for its first three rounds (8, 8, 8 matches). Detect elimination from the stage type, not from the match count. S Unverified: whether the API omits undrawn rounds; `firstDrawnRound` suggests it lists them with empty `matches`, and then the last round has 0 matches and no throw happens.
- Low: every single-elimination `normal` round with one match becomes `FINAL` (`bracket/integrations/ethlete.ts:64-69`). A one-match play-in round then gets the final card and the final's place in the layout. Type a round as final only by its position or by the API's `final` type; this changes the exported `generateRoundTypeFromEthleteRoundType` contract. M Re-rated from Medium: byes are modelled as matches inside a round, so a one-match normal round before the final is rare in Ethlete data.
- Low: the exported name `generateTournamentModeFormEthleteRounds` has a typo, "Form" for "From" (`bracket/integrations/ethlete.ts:92`). Decision: rename with a deprecated alias, or leave. S

## match

- Low: the default `matchName` and `resultName` labels hardcode "Live", "Finished", "vs.", "won", "Draw" and "points" (`match/match-labels.ts:92-113`). An app that localizes `live`, `finished` and `versus` still hears English in the accessible name. The normalizer's `Match ${n}` label is also hardcoded (`match/integrations/ethlete.ts:151`). Decision: pass the resolved labels into the name contexts (public type change), or document that `matchName`/`resultName` must be localized too. S

## standings

- Low: the default `'Advances'` label is English-only (`standings/integrations/ethlete.ts:71`). Decision: make `advancingLabel` required, or keep the English default. S

## Spec gaps

- Spec: no reduced-motion test for `match/match-score.component.ts`, and no card test that swaps `match` for a different id. S
- Spec: no `standings-pick` test that changes `participants` after a move. S
