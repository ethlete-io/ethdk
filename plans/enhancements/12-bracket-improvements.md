# 12 - Bracket improvements

Follow-up to `11-sport-match-components.md` (depends on its match card +
normalizer for §1 and §4's compact card). Four areas: responsive
bracket↔list switching, participant-level journey highlighting, a
tap/keyboard-friendly participant focus mode, and more layout/density modes.

## Current state (verified 2026-07-30)

- **Journey highlight** (`bracket/journey-highlight.ts`): pointer-only
  (`mouseover`/`mouseleave` on the host), DOM-driven - match elements and SVG
  paths carry participant short-id classes (`p\d+`); hovering a match (or
  line) activates **all** short-ids on it, i.e. both participants at once.
  Cards are opaque `ngComponentOutlet` hosts - nothing marks participant
  sub-elements, so participant-level hit-testing has no contract to hang on.
  Docs call it "a pointer-only affordance … not required to understand the
  bracket" (`bracket.md`).
- **Layouts** (`bracket/core/layout.ts`): `BRACKET_DATA_LAYOUT` =
  `LEFT_TO_RIGHT | MIRRORED`; `canRenderLayoutInTournamentMode` allows
  `MIRRORED` only for single elimination - double elimination is
  left-to-right only. Rounds already model `mirrorRoundType: 'left'|'right'`.
- **Sizing** is config-driven (`bracket.config.ts`: `columnWidth`,
  `matchHeight`, `finalColumnWidth`, `finalMatchHeight`, gaps, line
  geometry) - a density preset has clean hooks.

## 1. Responsive bracket ↔ match-list switching

A 32-team bracket in a mobile viewport (or a blog column) is unusable no
matter how compact the cards get. Provide a system that swaps representation:

- **`et-bracket-rounds-list`** (new): renders the same `BracketDataSource`
  as a vertical round-by-round list - round headers (same
  `roundHeaderComponent` resolution) + match cards per round (plan 11's
  compact card via the same normalizer), with either all rounds stacked or a
  round switcher (tabs/select) for long tournaments. Double elimination
  groups upper/lower brackets as sections. This is independently useful
  (match-day pages), not just a fallback.
- **Auto-chooser**: prefer a thin wrapper component (`et-bracket-adaptive`
  or an input on a shared host) that observes its container width
  (ResizeObserver / container queries can't swap components - this is JS)
  and renders `et-bracket` when the bracket's natural width fits (computable
  from round count × column config) or a threshold input, else the rounds
  list. Ship the wrapper only if it stays thin; otherwise document it as a
  **recipe** (the decision logic exported as a helper -
  `bracketFitsWidth(source, config, width)` - is the reusable part either
  way). Both representations share source + cards, so switching is cheap.
- Note in docs: the previously-backlogged zoom/pan idea (findings §5) is the
  _other_ answer to large brackets - switching representation is preferred;
  keep zoom/pan backlog.

## 2. Participant-level journey highlighting

Today hovering a match lights up both participants' journeys. Extend to
individual participants:

- **Participant marker contract**: cards mark participant sub-elements with
  an attribute (e.g. `data-et-bracket-participant` carrying the short-id) -
  the default cards (plan 11) set it; custom cards opt in by setting it too
  (documented; without markers, behavior stays whole-match as today).
  The bracket writes the short-id into the card via the existing short-id
  class mechanism - extend the outlet inputs or let cards read it from the
  match participant object (it's on `BracketMatchParticipantBase.shortId`;
  verify the card-facing shape exposes it - it does via `home`/`away`).
- **Hit-testing**: `onMouseOver` first checks
  `closest('[data-et-bracket-participant]')` → single-participant journey;
  falls back to the current match/path behavior (both journeys) when
  hovering the card chrome or a connector line.
- **Elimination endpoint**: a participant's journey ends where they're
  eliminated (`isEliminated` / the match where `result === 'loss'` in
  knockout context). Style that terminal match/participant distinctly -
  crossed-out / desaturated participant row at the elimination point, and
  don't highlight rounds beyond it. In double elimination the journey
  correctly continues into the lower bracket (the short-id classes already
  encode the true path - verify the classes stop at elimination; they
  should, since the participant appears in no later match).

## 3. Participant focus mode (touch + keyboard)

Journey highlight is hover-only - nonexistent on touch and invisible to
keyboard users.

- **Pinning**: tap/click on a participant (marker from §2) pins their
  journey (`focusedParticipantId` model on `et-bracket` - two-way, so apps
  can drive it from outside, e.g. a participants legend/list next to the
  bracket, or a query param). Tap again, tap empty bracket space, or Escape
  unpins. Pinned state uses the same highlight classes plus a
  `--focused` host class so CSS can dim non-journey elements more
  aggressively than on transient hover.
- **Interaction conflict - card clicks are taken.** Per plan 11's click
  semantics, a match card is _usually_ a link to a match detail page or a
  detail-overlay opener - that click must never be hijacked. Rules:
  clicking/tapping a card always does what the card says (navigate/open);
  pinning never rides on card or participant taps when the card is
  interactive (no pin-first-navigate-second double-tap patterns - that's
  surprising and breaks UX expectations). The supported pin affordances are:
  (a) driving `focusedParticipantId` from outside - a participants
  list/legend next to the bracket is the primary touch UX; (b) an explicit
  opt-in pin affordance rendered outside the card's link wrapper (plan 11's
  separated-slot rule); (c) direct tap on the participant marker **only**
  when the card has no click action of its own. Hover/`:focus-visible`
  journey preview (§2) stays available on linked cards regardless - it
  doesn't consume clicks.
- **Keyboard**: follows the same rules as pinning above - markers inside a
  linked card stay non-focusable (the card's link is the single tab stop;
  focusing it previews both journeys via `:focus-visible`), and the external
  affordance (participants list / explicit slot) is the keyboard pin path.
  Only on non-interactive cards do markers themselves become focusable
  (`tabindex` via the marker directive, `Enter`/`Space` toggles pin). This
  plus §2's endpoint styling upgrades the a11y story from "pointer-only
  affordance" to a navigable feature - update the docs accessibility section
  accordingly.
- Emits `participantFocusChange` output for analytics/URL sync.

## 4. Layout & density modes

- **Mirrored double elimination**: allow `MIRRORED` in
  `canRenderLayoutInTournamentMode` for double elimination and implement the
  grid math: upper bracket mirrors left/right toward the center like single
  elim; decide the lower bracket's placement (typical convention: upper
  bracket mirrored on top, lower bracket below left-to-right, grand final
  center-right - research real examples before committing; the
  `mirrorRoundType` model already exists on rounds). This is layout-engine
  work in `drawing/grid` - budget accordingly, and add
  swiss/group-stage guards (mirrored stays disallowed where it makes no
  sense).
- **Compact density**: a `density: 'default' | 'compact'` input backed by a
  config preset (smaller `columnWidth`/`matchHeight`/gaps/line curves) plus
  a **minimal match-card variant** below plan 11's compact threshold -
  participant `code` (or truncated name) + score only, no emblems, no
  time - sized for embedding a full bracket in a blog/article column.
  Implementation choice: this is plan 11's container-query card gaining one
  more (smaller) threshold, so the bracket just shrinks columns and the
  card adapts on its own - prefer that over a separate card component.
  Verify SVG connector geometry stays legible at compact sizes (curve
  amounts are config, include them in the preset).

## Verification & shipping

Stories: adaptive switcher at forced widths, rounds-list standalone (single +
double elim), participant hover vs match hover vs pinned focus (desktop),
focus mode on the mobile emulator (tap pin/unpin), keyboard journey
traversal, mirrored double elim (varied team counts incl. odd byes), compact
bracket inside a narrow container. Docs: `bracket.md` - layouts table,
journey/focus section (rewrite the a11y paragraph), adaptive recipe.
Changeset: `@ethlete/components` (minor). Coordinate with plan 11 (cards,
normalizer, marker contract) - implement 11 first or together.
