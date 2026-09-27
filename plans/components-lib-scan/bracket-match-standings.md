# bracket, match, standings (components) scan - open findings

Scan of `libs/components/src/lib/bracket/`, `libs/components/src/lib/match/`, `libs/components/src/lib/standings/` from 2026-09-28. 0 High, 10 Medium, 19 Low, 3 Spec (verified: 9 confirmed, 3 re-rated, 0 refuted, 1 unverified). Skipped: specs, stories, `testing/` drivers, most CSS (checked for `@layer`, colours and Tailwind only). The framework-free model in `libs/bracket` is out of scope.

## bracket: grid and journey highlight

- Medium: the pin drops on any Escape anywhere in the document (`bracket/journey-highlight.ts:209-214,224`). Escape that closes an unrelated dialog or menu also clears the pin, and one Escape clears every pinned bracket on the page. Ignore `event.defaultPrevented`, or listen only while focus or the pointer is in the host. S Verified.
- Medium: a participant reads as eliminated as soon as all of their matches are decided and the last one is a loss (`bracket/journey-highlight.ts:66-75`). In a swiss stage, every 0-1 participant is crossed out at their round-1 match until round 2 is drawn. Skip the elimination mark for swiss sources, or count losses against the stage's elimination threshold. M Verified.
- Low: comments outside the AGENTS.md allowlist at `bracket/bracket.component.ts:53-54,65-67,365-366,373-374`, `bracket/bracket.component.html:81,84-85`, `bracket/bracket-grid.ts:28-29`, `bracket/bracket-default-final-match.component.ts:36-38` (a repeat of the `BracketCardContext` JSDoc). S

## bracket: bundle size

- Medium: `resolveBracketComponents` imports all four default cards statically (`bracket/bracket-components.ts:9-12`). Every `et-bracket` consumer, and even the pure `bracketNaturalWidth` helper (`bracket/bracket-fits-width.ts:37`), bundles the final card with its icons, the match card and date-fns `format`, including an app that supplies its own cards. Let the width helper skip component resolution, and move the defaults behind the layout factories or the config. M Verified.
- Low: `BRACKET_IMPORTS` puts `BracketComponent`, `BracketParticipantsComponent` (and with it `ButtonComponent`), `BracketPickCardComponent` and `BracketRoundsListComponent` in one tuple (`bracket/bracket.imports.ts:6-11`). An app that renders only `et-bracket` bundles all four. Split into per-component import tuples. S Re-rated from Medium: each component is also exported on its own, and the `*_IMPORTS` tuple is the repo-wide convention.
- Low: `core/` and `linked/` are re-export shims over `@ethlete/bracket` (`bracket/core/index.ts:1` is `export * from '@ethlete/bracket'`). Import from `@ethlete/bracket` directly and delete the shims. S

## bracket: rounds list and cards

- Medium: a locked or readonly pick card shows the picked side only through `data-selected` (`bracket/bracket-pick-card.component.html:18-26`). A screen reader user cannot hear which side they picked after the deadline. Add visually hidden text, or keep `aria-pressed` semantics on a disabled button. S Verified.
- Low: a pick button's accessible name is the emblem `alt` followed by the name (`bracket/bracket-pick-card.component.html:5-16,50`). It reads "FC Berlin emblem FC Berlin". Give the button an `aria-label`, or give the emblem an empty `alt` inside the button. S
- Low: `uniqueId` is a module counter (`bracket/bracket-pick-card.component.ts:20,99`). Use `createComponentId` from core, as `bracket.component.ts:212` does. S
- Low: the error-theme lookup duplicates core's `injectErrorTheme` (`bracket/bracket-pick-card.component.ts:96-97`, `match/match-card.component.ts:80-82`). S
- Low: `sectionHeadingLevel` equals the round header level when `roundHeaderLevel` is 1 (`bracket/bracket-rounds-list.component.ts:147`). The `listSection` JSDoc says only consecutive rounds share a heading (`bracket/bracket-layout.ts:32-33`), but the list merges every round with the same id through a `Map` (`bracket/bracket-rounds-list.component.ts:167-175`). S
- Low: `BracketComponent` and `BracketRoundsListComponent` duplicate `resolvedLayout`, `resolvedMatchNormalizer` and a pass-through `resolvedRoundHeaderLevel` computed (`bracket/bracket.component.ts:199-204,262-267`, `bracket/bracket-rounds-list.component.ts:113-137`). Extract one helper. S

## bracket: Ethlete integration

- Low: the source maps only `published` to `completed` (`bracket/integrations/ethlete.ts:175`), but the match normalizer treats `finished` as finished too (`match/integrations/ethlete.ts:106-108`). A finished but unpublished match draws as finished on its card and as pending in the bracket model. Map both statuses in the same way. S Re-rated from Medium: the bracket model reads `status` only for tie detection, and `winner` comes from `winningSide` either way, so only an unpublished tie is affected.
- Medium: swiss detection throws `MODE_UNSUPPORTED` when the last round has as many matches as the first (`bracket/integrations/ethlete.ts:97-109`). If the API returns only the rounds drawn so far, a 16-team swiss stage fails for its first three rounds (8, 8, 8 matches). Detect elimination from the stage type, not from the match count. S Unverified: whether the API omits undrawn rounds; `firstDrawnRound` suggests it lists them with empty `matches`, and then the last round has 0 matches and no throw happens.
- Low: every single-elimination `normal` round with one match becomes `FINAL` (`bracket/integrations/ethlete.ts:60-63`). A one-match play-in round then gets the final card and the final's place in the layout. The comment above it is a TODO without an issue link. Type a round as final only by its position or by the API's `final` type. M Re-rated from Medium: byes are modelled as matches inside a round, so a one-match normal round before the final is rare in Ethlete data.
- Low: the exported name `generateTournamentModeFormEthleteRounds` has a typo, "Form" for "From" (`bracket/integrations/ethlete.ts:87`). The duplicate checks at `:138,161` scan arrays in a loop; use a `Set`. S

## match

- Medium: the score transition ignores the match id (`match/headless/match-card.directive.ts:277-296`), and so does `MatchScoreComponent`'s revision (`match/match-score.component.ts:44-50`). The bracket grid tracks cells by `$index` (`bracket/bracket.component.html:60,67`), so a re-layout (swiss groups reshuffle) gives a live card a different match. The card then emits `scoreChange` and rolls the digits from the old match's score. Reset the transition when `match().id` changes. S Verified. `scoreChange` emits on the swap even for a non-live card; the roll runs only for a live one.
- Medium: `format()` throws a `RangeError` for an Invalid Date (`match/headless/match-card.directive.ts:299-307`). The Ethlete normalizer builds `new Date(match.startTime)` without a check (`match/integrations/ethlete.ts:139`), so one malformed timestamp breaks the card. Check `isValid` and return `null`. S Verified (repro).
- Low: the first `animationend` (the 220ms digit) clears the 520ms flash (`match/match-score.component.ts:18,72-77`). The flash disappears near its peak. `settleFlash` only calls `settle`. S
- Low: the default `matchName` and `resultName` labels hardcode "Live", "Finished", "vs.", "won", "Draw" and "points" (`match/match-labels.ts:92-112`). An app that localizes `live`, `finished` and `versus` still hears English in the accessible name. The normalizer's `Match ${n}` label is also hardcoded (`match/integrations/ethlete.ts:151`). S
- Low: the seed badge puts `aria-label` on a generic `<span>` (`match/match-participant.component.ts:74`). Many screen readers ignore it. Use visually hidden text. S
- Low: the list of natively interactive tags is duplicated (`match/match-participant.component.ts:122`, `match/headless/match-card.directive.ts:40`). S
- Low: an empty-string `name` draws a blank row instead of the `tbd` label (`match/match-participant-name.ts:25-27`). `charAt(0)` splits an emoji's surrogate pair in the emblem mark (`match/match-participant.component.ts:151`). S

## standings

- Medium: after the first move, `order` holds the ids of the old participants (`standings/headless/standings-pick.directive.ts:86-131`). The directive writes `order` even when the consumer does not bind it. If `participants` then changes (a tab switch to another group), `rows` drops every unknown id and never adds the new participants, so the list can go empty. `move` also indexes `resolvedOrder` while the template passes the index into `rows`, so a stale id moves the wrong row. Reconcile `order` with `participants` (drop unknown ids, append missing ones) and index moves against the reconciled list. M Verified.
- Medium: the form column puts `aria-label` on empty generic spans (`standings/standings.component.html:86-90`), and it tells win, tie and loss apart by opacity alone (`standings/standings.component.css:185-195`). Assistive tech often reads nothing, and the dots fail WCAG 1.4.1. Add `role="img"` or hidden text, and a non-colour mark. S Verified.
- Medium: a keyboard reorder announces nothing (`standings/standings-pick.component.html:32-46`). Focus stays on the handle, but a screen reader user does not hear the new position. Add a polite live region with a `pickMoved(participant, position)` label. S Verified. `pickMoveRow` names the participant but not the position.
- Low: the legend tracks by `zone.label` (`standings/standings.component.html:104`). Two zones with the same label cause a duplicate-key error. Track by `$index` or by `from`. S
- Low: a hardcoded shadow colour `rgb(0 0 0 / 0.25)` (`standings/standings-pick.component.css:85`). S
- Low: the default `'Advances'` label is English-only, and the JSDoc example hardcodes the theme name `'success'` without saying it belongs to the app (`standings/integrations/ethlete.ts:56,70`). S

## Spec gaps

- Spec: no spec for `match/match-score.component.ts` (roll, settle, reduced motion), and no card test that swaps `match` for a different id. S
- Spec: no `standings-pick` test that changes `participants` after a move. S
- Spec: no journey-highlight test for Escape with `defaultPrevented`, or for elimination marks in a swiss source. S
