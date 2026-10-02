# bracket — DX scan 2026-10-02

Scope: `libs/bracket`, `libs/components/src/lib/bracket`, `libs/components/src/lib/match`,
`libs/components/src/lib/standings`, guides `apps/docs/bracket/index.md`,
`apps/docs/components/{bracket,bracket-prediction,bracket-rounds-list,match,standings,standings-pick}.md`,
`apps/docs/components/error-codes.md`.

| ID    | Sev    | Kind | Decision | Title                                                                                        | Status                                                                       |
| ----- | ------ | ---- | -------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| BR-01 | High   | bug  | yes      | The Ethlete integration throws ET3401 for a stage before its draw, which the engine can draw | fixed                                                                        |
| BR-02 | Medium | dx   | no       | One `match-outcome` slot silently drops the connectors of every match without provenance     | fixed                                                                        |
| BR-03 | Medium | dx   | yes      | `previousMatchIds` cannot reach `<et-bracket>`, so drawn lines and resolved picks disagree   | fixed                                                                        |
| BR-04 | Medium | dx   | no       | The custom card example in the bracket guide does not compile                                | fixed                                                                        |
| BR-05 | Medium | dx   | no       | An unknown `roundId` throws ET3406 without the id; the docs send you to ET3411               | fixed                                                                        |
| BR-06 | Medium | dx   | yes      | Engine errors are a non-exported `BracketRuntimeError` with no `code`; no way to fail softly | fixed (class + code + guide snippet); soft-fail mode on `<et-bracket>`: open |
| BR-07 | Medium | dx   | no       | The guide never says round and match order in the source is the bracket's structure          | fixed                                                                        |
| BR-08 | Medium | dx   | yes      | `BracketSlotSource` needs six fields per slot and has no constructors                        | open (user decision)                                                         |
| BR-09 | Medium | dx   | no       | `BracketPickCardComponent.predictedLabel` is a hardcoded English default outside the labels  | fixed                                                                        |
| BR-10 | Low    | dx   | no       | App-wide normalizer and cards are typed `any`; the guide's examples hide it                  | fixed                                                                        |
| BR-11 | Low    | dx   | no       | Unknown `focusRoundId` / `rowSpanRoundId` / `selectedRoundId` are silently ignored           | fixed                                                                        |
| BR-12 | Low    | dx   | no       | `StandingsZone.color` is `string`, and its JSDoc promises a theme object it cannot take      | fixed                                                                        |

## BR-01 The Ethlete integration throws ET3401 for a stage before its draw, which the engine can draw

- Where: `libs/components/src/lib/bracket/integrations/ethlete.ts:94-115` (`generateTournamentModeFromEthleteRounds`, called at `:123`); engine side `libs/bracket/src/lib/linked/round-relations.ts:447-448`.
- Problem: the mode is read from `matches[0].matchType` of the first round that has a match. A stage the API
  publishes with its rounds but no matches yet (`[{ round: {...}, matches: [] }, ...]`) throws
  `ET3401: No matches found` - in production too, from inside the `source` computation of the page. The engine
  itself accepts such a source ("Nothing is drawn yet, so there is nothing to relate - not a malformed
  structure", round-relations.ts:447), and the guide says an undrawn round "is not an error"
  (`apps/docs/components/bracket.md:239-240`). So a hand-built source renders, the shipped integration crashes.
  Neither the error text nor the ET3401 row in `error-codes.md:329` points to `<et-bracket-skeleton>`.
- Fix: give `generateBracketDataForEthlete` an optional second argument `{ mode?: TournamentMode }` that wins
  over inference; also infer `double-elimination` from a `winner_bracket`/`loser_bracket` round type before
  giving up. Throw ET3401 only when `source` is empty, or when no mode can be found, with a message that names
  the `mode` option and the skeleton. Add a spec for the empty-stage case.
- Breaking: no. Decision: yes (whether inference from round types is acceptable, or `mode` becomes required).
- Status: fixed
- Review: ok

## BR-02 One `match-outcome` slot silently drops the connectors of every match without provenance

- Where: `libs/bracket/src/lib/linked/match-relations.ts:363-371` (switch to the declared graph), `:497-501` (unknown feeder ids dropped by `.filter`), `:502-576` (a match with neither previous nor next gets no relation).
- Problem: if any match in the source carries a `match-outcome` slot, the whole bracket is linked from the
  declared graph. An API that sends provenance only for some matches (e.g. only the final's
  `homeSource`/`awaySource`) loses every quarter-final → semi-final connector with no error. A slot whose
  `matchId` has a typo is also dropped silently. The rule is in the core guide
  (`apps/docs/bracket/index.md:33-35`), but the components guide - the one Angular consumers read - only says
  prediction sources "may additionally set" the slots (`apps/docs/components/bracket.md:203-206`).
- Fix: in `createBracket`, when the declared graph is used, collect matches outside the first round that end
  up with relation `none`, and slot `matchId`s that name no match; the components hosts report them in
  `ngDevMode` with a `console.warn` naming the ids (an engine-side `onWarning` callback option keeps
  `@ethlete/bracket` framework-free). Copy the all-or-nothing sentence into the components guide's Data
  source section. Add a spec with a partial-provenance source.
- Breaking: no. Decision: no.
- Status: fixed
- Review: fixed a false `unlinked-match` warning for a third-place match a custom `previousMatchIds` leaves without feeders (spec added)

## BR-03 `previousMatchIds` cannot reach `<et-bracket>`, so drawn lines and resolved picks disagree

- Where: `libs/components/src/lib/bracket/bracket.component.ts:255`, `bracket-rounds-list.component.ts:145`, `libs/bracket/src/lib/core/bracket.ts:27-30`.
- Problem: `CreateBracketOptions.previousMatchIds` is exported and documented for prediction apps
  (`apps/docs/components/bracket-prediction.md:72-74`, `apps/docs/bracket/index.md:24-31`), and is the natural
  fit for an API that ships `previousMatchIds`/`nextMatchId` instead of slot provenance. But both hosts call
  `createBracket(source, { layout })` with no way to pass it. The app's own `createBracket(source,
{ previousMatchIds })` for `resolveBracketSlot` then links one graph while the bracket draws the positional
  one - connectors and resolved picks can point at different matches.
- Fix: either add an optional `previousMatchIds?: (match) => string[]` to `BracketDataSource` (the source then
  carries its graph everywhere it goes, including `bracketNaturalWidth`), or add a `previousMatchIds` input to
  both hosts and the skeleton plus a `BracketConfig` key. The source field is the smaller surface.
- Breaking: no. Decision: yes (source field vs host input).
- Status: fixed (host input `previousMatchIds` on `<et-bracket>` and `<et-bracket-rounds-list>`)
- Review: ok

## BR-04 The custom card example in the bracket guide does not compile

- Where: `apps/docs/components/bracket.md:473-484`; `libs/bracket/src/lib/core/match-participant.ts:18-26`.
- Problem: the Custom cards example renders `{{ bracketMatch().home?.name }} vs {{ bracketMatch().away?.name }}`.
  `BracketMatchParticipant` has `id`, `shortId`, `side`, `result`, counts - no `name`. Under `strictTemplates`
  this is a compile error; without it the card renders `undefined vs undefined`. It is the first thing a
  consumer copies when wiring their own card. The "Making cells navigate" example (`bracket.md:410-426`) names
  its class `BracketMatchComponent`, which collides with the exported type of the same name from
  `@ethlete/components` the reader is importing beside it.
- Fix: rewrite the example to read the name from `bracketMatch().data` (or through a normalizer), and say in
  one line that the linked participant carries ids only, names live in `data`. Rename the example class to
  `AppBracketMatchComponent`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## BR-05 An unknown `roundId` throws ET3406 without the id; the docs send you to ET3411

- Where: `libs/bracket/src/lib/core/match.ts:65-69`; `apps/docs/components/error-codes.md:334,339`.
- Problem: a match whose `roundId` names no round (a common adapter slip: the API's `round.uuid` vs `round.id`)
  throws `ET3406: Round for match with id m1 not found`. The message omits the `roundId` it looked for, and the
  error-codes page gives the "ensure every match `roundId` references an existing round" fix under ET3411,
  while ET3406's row talks only about match counts. The developer reads the wrong row. The other relation
  errors (`match-relations.ts:171,198,202,246-250,303-307,340-342`) are bare "Next round match not found" with
  no match or round id at all.
- Fix: message `Match "m1" names round "r9", which is not in source.rounds (known: r1, r2, ...)`. Include the
  current match id and round id in every `MATCH_RELATION_INVALID` message. Move the roundId fix text to the
  ET3406 row and give ET3411 a fix that matches when it actually fires (an internal lookup - report as a bug).
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## BR-06 Engine errors are a non-exported `BracketRuntimeError` with no `code`; no way to fail softly

- Where: `libs/bracket/src/lib/bracket-runtime-error.ts:1-6`, `libs/bracket/src/index.ts:1-8` (not exported); `apps/docs/components/bracket.md` (Error codes section, and migration table row "Errors | `RuntimeError` (ET34xx)").
- Problem: the same ET34xx range is thrown by two classes: the engine's `BracketRuntimeError` (plain `Error`, no
  `code` property, not exported) and `@ethlete/core`'s `RuntimeError` (the Ethlete integration, the card
  checks). The guide says all are `RuntimeError`. An app that wants to show "bracket unavailable" for a
  malformed API response instead of a dead page has to string-match `err.message.startsWith('ET34')`, and it
  must do so around its own `createBracket` call, because `<et-bracket>` throws from inside a `computed`
  (`bracket.component.ts:255`) and offers no error state.
- Fix: export `BracketRuntimeError` with a public `code: number` (same shape as core's `RuntimeError`), fix
  the guide wording, and add a short "Rejecting bad data" snippet: `try { createBracket(source, { layout }) }
catch (e) { if (e instanceof BracketRuntimeError) ... }`. Optionally export `validateBracketSource(source)`
  returning the error instead of throwing.
- Breaking: no. Decision: yes (whether a `validateBracketSource` API is wanted).
- Status: fixed (exported class with `code`, guide snippet); soft-fail mode on `<et-bracket>`: open
- Review: ok

## BR-07 The guide never says round and match order in the source is the bracket's structure

- Where: `libs/bracket/src/lib/core/round.ts:109-138` (depth assigned in source order; only `final`, `reverse-final`, `third-place` are re-sorted), `libs/bracket/src/lib/core/match.ts:52,113` (`position` = index in the round's source array); `apps/docs/components/bracket.md:191-267`.
- Problem: without slot provenance, pairing is positional: matches 1 and 2 of a round feed match 1 of the
  next, and round depth follows the array order. An API that lists rounds newest-first or sorts matches by
  kick-off draws crossed connectors or throws ET3406 with no hint why. The Data source section documents the
  field names only; the Storybook generator states the rule in a comment
  (`stories/generate-bracket.ts:10-12`) that no consumer sees.
- Fix: add to the Data source section: rounds in play order (upper and lower rounds interleaved as played),
  matches in bracket order top to bottom, and "or declare `homeSource`/`awaySource` and order stops
  mattering". Link it from the ET3406 row.
- Breaking: no. Decision: no.
- Status: fixed
- Review: fixed a run-on line in the guide

## BR-08 `BracketSlotSource` needs six fields per slot and has no constructors

- Where: `libs/bracket/src/lib/integrations/base.ts:3-16`; examples `apps/docs/components/bracket.md:207-233`, `libs/components/src/lib/bracket/stories/bracket-prediction-storybook.component.ts:32-39`.
- Problem: every slot spells `kind`, `role`, `matchId`, `standingId`, `rank`, `label` even for a `bye`, and the
  flat type accepts states that mean nothing (`{ kind: 'seed', role: 'winner', matchId: 'x' }`). The guide's
  one-match example is 20 lines. The stories and the specs each define their own `matchOutcome()` helper - the
  sign a public one is missing.
- Fix: export slot constructors from `@ethlete/bracket` (re-exported by components):
  `bracketSlot.matchOutcome(matchId, role)`, `.standingRank(standingId, rank, standingName?)`, `.seed(seed)`,
  `.swissBucket()`, `.bye()`, `.external(label)`, each taking an optional `label`. Use them in the guide, the
  stories and the specs. Separately decide whether `BracketSlotSource` becomes a discriminated union per
  `kind` (breaking).
- Breaking: constructors no; union yes. Decision: yes (union).
- Status: open (user decision)
- Review: not reviewed (open)

## BR-09 `BracketPickCardComponent.predictedLabel` is a hardcoded English default outside the labels

- Where: `libs/components/src/lib/bracket/bracket-pick-card.component.ts:88` (`input('Prediction')`), used for the accessible name at `:138` and the hidden text in `bracket-pick-card.component.html:61`.
- Problem: every other pick-card string comes from `provideBracketLabels()` (`pickCardPicked` at `:103`, the
  slot wording), so a localized app sets the labels once and still ships "Prediction" in the accessible name of
  every predicted side, unless it binds `predictedLabel` on each card it renders.
- Fix: add `pickCardPredicted: 'Prediction'` to `BracketLabels`; make the input `string | null` defaulting to
  `null` that falls back to the label. Update the labels table in `bracket.md` and `bracket-prediction.md:132,305`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## BR-10 App-wide normalizer and cards are typed `any`; the guide's examples hide it

- Where: `libs/components/src/lib/bracket/bracket.config.ts:19,164-166`, `bracket-card-context.ts:20-22`; `apps/docs/components/bracket.md:69,385-399`.
- Problem: `provideBracketConfig` is fixed to `BracketConfig<any, any>`, so `matchNormalizer: (match) =>
match.data.kickOf` (typo) compiles. The guide's normalizer example relies on that `any`, and the Usage
  example annotates `source: BracketDataSource<unknown, unknown>`, discarding the generics the next section
  advertises ("the source it returns is typed with your round and match types").
- Fix: in the guide, annotate the normalizer parameter (`(match: BracketMatch<MyRound, MyMatch>) => ...`) and
  drop the `unknown` annotation. Optionally export `defineBracketMatchNormalizer<TRound, TMatch>(fn)` as an
  identity helper that fixes the generics.
- Breaking: no. Decision: no.
- Status: fixed (guide only, no helper)
- Review: ok

## BR-11 Unknown `focusRoundId` / `rowSpanRoundId` / `selectedRoundId` are silently ignored

- Where: `libs/components/src/lib/bracket/bracket.component.ts:289-302` (offset falls back to 0), `libs/bracket/src/lib/drawing/grid/row-span.ts:10-15`, `libs/components/src/lib/bracket/bracket-rounds-list.component.ts:164-169` (renders an empty list).
- Problem: these take ids from the source. A stale id after the API re-keys rounds, or the round's `name`
  passed instead of its `id`, gives an unmoved bracket or a blank rounds list with no message.
- Fix: in `ngDevMode`, `console.warn` once per value when the id matches no round, listing the known ids.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## BR-12 `StandingsZone.color` is `string`, and its JSDoc promises a theme object it cannot take

- Where: `libs/components/src/lib/standings/standings.types.ts:42-44`; used with `[etProvideColor]` at `standings.component.html:48,105`.
- Problem: the JSDoc says "A registered color theme name (or the theme object)", but the type is `string`, so
  the object does not type-check and a typo in the name is not caught, while the sibling
  `MatchCardComponent.liveColor` (`match-card.component.ts:79`) takes `RegisteredColorThemeName | ColorTheme`.
- Fix: type it `RegisteredColorThemeName | ColorTheme`, the same as `liveColor`. Give `normalizeEthleteGroupRanking`'s `advancingColor` option
  (`libs/components/src/lib/standings/integrations/ethlete.ts:63`, also `string`) the same type.
- Breaking: no (widening for objects; narrowing only for apps that registered theme names and pass an unknown one). Decision: no.
- Status: fixed
- Review: ok
