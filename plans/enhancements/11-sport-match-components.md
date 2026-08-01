# 11 - Sport/esport match components

Match card (container-size adaptive: bracket-compact and featured-big in one
component), bracket final-match card, bracket round header, continue card,
horizontal match list. Closes the bracket's two standing TODOs (opinionated
default cards + the a11y TODO in `bracket.md:177-187`) - the "barebones debug
placeholder" cards become real.

## Hard requirement: API-shape agnostic via normalization

These components must work with **any** backend shape. `@ethlete/types`'
`MatchListView` is just the first-class example, not the model.

- Define a **normalized match view-model** in the new domain (shape owned by
  the components lib, not by `@ethlete/types`):

  ```ts
  type NormalizedMatchParticipant = {
    id: string;
    name: string | null; // display name (team name / gamertag)
    code: string | null; // short code for compact rendering ("FCB")
    emblem: NormalizedMedia | null; // sources consumable by et-picture
    seed: number | null;
  };
  type NormalizedMatch = {
    id: string;
    status: 'scheduled' | 'live' | 'finished';
    startTime: Date | null;
    home: NormalizedMatchParticipant | null; // null = TBD slot
    away: NormalizedMatchParticipant | null;
    homeScore: number | null;
    awayScore: number | null;
    // series/best-of detail (Bo3/Bo5 map wins); null = single game
    gameScores: { home: number; away: number }[] | null;
    winnerSide: 'home' | 'away' | null;
    label: string | null; // "Match 3", "Grand Final" - free text
  };
  ```

  Exact fields to be finalized against real consumer needs - but keep it
  deliberately minimal + presentation-oriented; anything exotic stays in the
  consumer's own custom card.

- **Adapters are plain functions**, mirroring `bracket/integrations/ethlete.ts`:
  ship `normalizeEthleteMatch(match: MatchListViewUnion): NormalizedMatch` in
  an `integrations/` folder (maps `status`
  `preparing/started/finished/published`, `homeScore.score`, `games`,
  participant `name`/`code`/`gamertag`/`emblem: MediaView`). Other APIs write
  their own `(data) => NormalizedMatch` - no DI required for direct usage.
- **Bracket defaults need DI**: the bracket passes opaque `TMatchData` to
  cards, so the default cards can't assume a shape. Add a normalizer
  registration to `BracketConfig` / `provideBracketConfig`
  (`matchNormalizer?: (data: TMatchData) => NormalizedMatch`) plus an input on
  `et-bracket`. Default cards inject it; if absent in dev mode, throw a coded
  error telling the consumer to provide one or supply custom cards (keeps
  today's escape hatch intact). The Ethlete bracket integration exports a
  ready-made config so `generateBracketDataForEthlete` users get working
  defaults with one provider line.

## 1. `et-match-card` - one card, container-adaptive

- Consumes `NormalizedMatch` via a `match` input. Renders: both participants
  (emblem via `et-picture`, name with `code` fallback in compact), score or
  start time (scheduled → localized time via `DATE_LOCALE` pipeline), series
  game-scores when present, winner emphasis, live state (semantic color via
  theme type - no hardcoded theme names), TBD slots for null participants.
- **Container-size adaptive**: `container-type: inline-size` on the host with
  `@container` threshold rules - compact row layout (bracket/list density)
  below a threshold, expanded card (bigger emblems, game-score breakdown,
  label/time row) above. Note: this is the repo's **first** threshold-based
  `@container` usage (existing uses are `cqw` unit sources only) - no
  fallback concerns at the repo's evergreen baseline, but establish the
  pattern deliberately (named container, documented thresholds, overridable
  via CSS vars). An explicit `size` input (`'auto' | 'compact' | 'expanded'`)
  overrides for consumers who want fixed rendering regardless of width.
- A11y (closes the bracket TODO): the card is one labelled group - accessible
  name composed from participants + score/time + status
  ("FC Berlin vs. Neon Esports, 2 : 1, finished"). Strings via a new match
  labels token (`03-i18n-consolidation.md` pattern).
- **Click semantics - assume a match detail target.** In real apps the card
  is nearly always interactive: router navigation to a match detail page or
  opening a match detail overlay. Support both first-class: anchor/routerLink
  rendering (the whole card is the link, accessible name = the composed match
  name) and composition with the overlay-opener directives (see
  `overlay-openers.md`; routed/query-param overlays make shareable detail
  overlays). The card itself must stay **one single interactive element** -
  no nested buttons/links inside the default card (scores, emblems,
  participants are non-interactive display). Anything that wants its own
  interactivity (plan 12's participant pinning, a "follow" affordance) must
  be an explicitly separated, opt-in slot rendered _outside_ the link
  wrapper - never a click-target layered inside it.
- Headless tier per `component-architecture`: a headless directive owning
  state/aria + slot directives, default styled component on top.

## 2. Bracket default cards

All in the bracket domain, replacing the debug placeholders as the shipped
defaults (resolution order unchanged: explicit input → swiss → config →
default):

- **Default match card**: wraps `et-match-card` (compact via container width -
  bracket columns are narrow, so it lands compact naturally), reading
  `NormalizedMatch` through the registered normalizer. Keeps
  `bracketRoundSwissGroup` awareness.
- **Final-match card** (`finalMatchComponent` slot): a **distinct standout
  design, not just the expanded size** - reusing the expanded card here would
  be lame. Own styled component (sharing the headless match-card directive
  and the normalizer): hero treatment with trophy iconography, accent
  surface/border glow via theme tokens, `bracketRound.name` as a title
  ("Grand Final"), larger emblems, and a **champion state** once
  `winnerSide` is set (winner spotlighted, e.g. crowned emblem + name
  emphasis, loser de-emphasized). Wider column via bracket grid column-width
  config (verify the grid supports per-column width; the final already gets
  its own column). Keep it tasteful and token-driven - apps with strong
  brand identities will replace it, so the default must look shippable
  without being loud.
- **Round header**: round name + optional swiss group name + match count,
  proper heading semantics (the a11y TODO asks for a navigable structure -
  give headers real heading roles/levels configurable via input).
- **Continue card**: "N winners advance" with the next-stage affordance,
  accessible label.
- Update `bracket.md`: remove the WIP warning + both TODO comments, document
  the normalizer requirement and the defaults; keep the custom-card section.

## 3. `et-match-list` - horizontal match strip

"Today's matches" rail: compose `et-scrollable` (the simpler `@for`-children
precedent - no loop/clone semantics needed, so no carousel machinery):
`snap`, `scrollMode="element"`, masks + buttons on desktop, per-breakpoint
`itemSize`. The component takes `matches: NormalizedMatch[]` + optional
`etMatchCardTemplate` override, renders `et-match-card`s (compact) with
`[etScrollableActiveChild]` on the live match (auto-scrolls into view).
Header slot for a title + "all matches" link. Decide during implementation
whether this earns a component at all or is a documented recipe + story on
top of scrollable - if the component is <50 lines of pass-through inputs,
ship the recipe instead.

## 4. Live score-change animation system

When a live match's score changes (goal, map win), the card should react -
this is the moment sports UIs live for.

- Score-change detection is signal-driven: the card compares incoming
  `NormalizedMatch` score values against the previous ones (per side, and per
  game-score entry). Data updates come from the consumer's `@ethlete/query`
  polling/sockets - the card stays dumb about transport.
- On change: a **score ticker** animation on the changed digit (old value
  rolls/flips out, new value in - animate the real elements, never clones,
  per the repo's no-clone-animations rule) plus a brief card-level accent
  pulse on the scoring side (theme-token color, `@starting-style` or WAAPI -
  whichever fits the lifecycle; reduced-motion → instant swap, no pulse).
- Expose the moments as outputs (`scoreChange` with side + delta) so
  consumers can attach their own effects (confetti, sound) without the card
  shipping any.
- `animateScoreChanges` input (default true). No animation on first render or
  when the value arrives non-live (status `finished`).
- If the digit-ticker generalizes cleanly, extract a small value-change
  ticker primitive (core or match domain internals) - decide by how entangled
  it is with card styling; don't force a premature abstraction.

## 5. `et-standings` - standings/group table with zone legend

League/group standings with promotion/relegation/advancement semantics:

- Normalized row model, same adapter philosophy as the match card:
  `NormalizedStandingRow` - position, participant
  (`NormalizedMatchParticipant` reused), played/wins/ties/losses, score-like
  aggregates (points, game diff), optional recent-form
  (`('win'|'loss'|'tie')[]`). Ethlete adapter mapped from the ranking/
  standings views in `@ethlete/types` (verify exact source views during
  implementation - `MatchRankingView` exists; check for a dedicated
  standings/ranking list view).
- **Zones**: config like `{ from: number; to: number; type: string; label:
string }[]` where `type` resolves a semantic theme color (advancing,
  relegating, playoff - names are consumer-defined per the no-hardcoded-
  theme-names rule). Rows in a zone get an inline-start accent bar +
  tinted background; an optional **legend** renders below the table from the
  same zone config (color swatch + label), so legend and banding can't drift
  apart.
- Semantics: a real `<table>` (caption, column headers with abbr for the
  W/D/L columns) - likely bespoke markup rather than composing the data-table
  lib (standings are fixed-shape and presentation-heavy; the table lib's
  typed-column machinery buys little here - confirm during implementation,
  don't build two ways).
- Compact mode via the same container-query pattern as the match card
  (narrow: position, participant, points; wide: full columns + form).
- Highlighted row input (e.g. "your team").

## 6. Recipes, not components

Competition card, player card, team card, nation card: these are
composition exercises (et-picture + typography + link + skeleton) whose
fields vary too much per product to normalize. Ship them as **documented
recipes** - a "Sport UI recipes" docs section with copy-paste stories
composing the primitives from this plan (participant display, picture,
skeleton, chip) - not as library components. If a recipe later proves
universal, promote it.

## Also in scope (small)

- **Participant display primitive** (`et-match-participant` or similar):
  emblem + name/code + optional seed, used inside the card and standalone
  (rosters, standings cells). Composes `et-picture` with skeleton loading
  state.
- New error-code range for the match domain (next free: `4000–4099`) +
  docs page (`apps/docs/components/match.md`) + stories for every size/state
  (scheduled/live/finished, TBD, series, long names, RTL).

## NOT in scope (backlog, findings §5 additions)

Match detail page patterns, live-updating transport bindings (consumer wires
`@ethlete/query` polling/sockets; cards are dumb), countdown timer,
head-to-head stats card, badge component (tracked in `opportunities.md` new
components - a live indicator here uses status styling, not a generic badge).

## Verification & shipping

Stories: match card at forced container widths (compact/expanded/auto
breakpoint crossing), live score-change animation (scripted score mutation,
reduced-motion variant), full bracket with real defaults incl. the standout
final card champion state (single/double/swiss), standings with zones +
legend + compact mode, match list rail on mobile emulator (snap + touch).
A11y pass: names announced per card, bracket heading structure navigable,
standings table semantics, score changes announced politely (aria-live on the
score region - announce "2 : 1" once, not per animation frame). Docs: new
`match.md` (+ standings + recipes sections) + `bracket.md` rewrite of the
placeholder sections. Changeset: `@ethlete/components` (minor). Coordinate
with `03-i18n-consolidation.md` for the labels token; `@ethlete/types`
untouched (adapters live in components).
