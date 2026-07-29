# 07 — Masonry

**Status: DONE (2026-07-30).** Size: M. Research done 2026-07-23 against
`libs/cdk/src/lib/components/masonry/` (~580 lines). Shipped net-new in
`libs/components/src/lib/masonry/`. cdk masonry untouched.

## What cdk ships today

Classic JS column-balancing masonry: greedy shortest-column placement,
absolute positioning via inline `translate3d` + height, host height set
imperatively. Items measured via `getBoundingClientRect`, resize via
`signalElementDimensions` on a sentinel element, full-vs-partial invalidation
(newly appended items only reposition from their index), 150 ms transform
transition after init, fade-in on first position, `initializing`/`initialized`
outputs. Two legacy accessor `@Input`s (`columWidth` — note the typo — and
`gap`, both BehaviorSubject-backed), required `key` input per item,
`role="listitem"`. Notable coupling: `injectInfinityQueryResponseDelay`
(`@ethlete/query`) — delays infinite-scroll fetches until layout settles. No
colors at all (nothing to theme).

## Decision: keep a JS engine (research spike, resolved 2026-07-30)

The plan asked for this to be decided with evidence and recorded. Evidence:

- **Native CSS masonry is not usable.** The spec is now CSS Grid Level 3 with
  `display: grid-lanes` (renamed from `grid-template-rows: masonry`, itself the
  survivor of the 2025 `display: masonry` vs grid-integrated debate). MDN as of
  2026-03 states it "is not Baseline because it does not work in some of the
  most widely-used browsers", and lists no engine shipping it unflagged. Probed
  the repo's own headless Chromium (149.0.7827.55): `CSS.supports` is `false`
  for `grid-template-rows: masonry`, `display: masonry`, and `item-pack:
balance`. Safari 26 shipped grid-lanes first; Firefox is flag-only. The syntax
  has also changed twice, so betting on it now would mean shipping an API around
  a moving target.
- **CSS `columns` is still wrong for feeds.** It fills column by column, so
  visual order ≠ DOM order — which breaks tab order and screen-reader order, the
  one thing a JS engine gets right for free.

So: JS engine, rewritten signals-first. Revisit when grid-lanes reaches Baseline;
the directive's public API (`columnWidth`, `gap`, `isSettled()`) would survive a
CSS-backed reimplementation largely intact.

## What shipped

`libs/components/src/lib/masonry/`:

| File                                           | Role                                                            |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `headless/masonry.directive.ts`                | The engine: columns, layout, settling, resize state             |
| `headless/masonry-item.directive.ts`           | Per-item measurement, width/offset bindings, reveal             |
| `headless/internals/masonry-layout.ts`         | Pure `resolveMasonryColumns` + `packMasonryItems` (+ spec)      |
| `headless/internals/masonry-resize-settled.ts` | Debounced "container is being resized" signal                   |
| `masonry-styles.component.ts` / `.css`         | Structural CSS + public motion tokens, mounted by the directive |
| `masonry.types.ts`, `masonry-errors.ts`        | Placement/column types; `ET3900`–`ET3901`                       |
| `masonry.spec.ts`                              | Directive wiring over a faked jsdom geometry                    |
| `stories/`                                     | 4 stories (default, narrow, appending, single column)           |

Plus `apps/docs/components/masonry.md` (+ sidebar, overview, error-codes page)
and a `minor` changeset.

## Deviations from the plan (all deliberate)

- **No Tier 3 component.** Shipped directives only — no `<et-masonry>` element.
  The plan said "headless split where sensible"; a Tier 3 component here would
  own nothing, since masonry has no visual opinion (no colors, no chrome) and no
  template structure to impose. Leaving the element to the consumer is also
  strictly better for a11y: `<ul etMasonry>` + `<li etMasonryItem>` gets list
  semantics natively. The structural CSS a headless composition still needs is
  mounted by the directive via `injectStyleManager()` (the
  `ButtonStylesDirective` pattern), so the directive form is fully functional on
  its own. That styles-only component is consequently where the domain's public
  `@property` tokens live.
- **Dropped the required per-item `key`.** The plan said keep it. It has no job
  left: identity is the directive instance, and content changes are _observed_
  (per-item `ResizeObserver`) rather than announced, which is exactly what the
  key existed to do in cdk.
- **Dropped partial invalidation.** The plan said keep it "important for
  infinite scroll". The property that actually mattered — appended items never
  disturb the ones already placed — is inherent to greedy packing: where items
  `0…k` land depends only on items `0…k`. So the whole layout is one `computed`
  and appending re-derives the existing placements _identically_; Angular's
  binding dedupe is what stops them being written to the DOM again. Covered by a
  prefix-stability unit test.
- **Added stable column assignment + `repack()`** (not in the plan; came out of
  review). Greedy packing is stable against items being _added_ but not against
  an existing item changing _height_ — a card growing changes which column is
  shortest for everything after it, so items hopped columns because a paragraph
  two columns over expanded. Items therefore keep the column they were first
  given while the column count holds, and only re-stack within it. A column-count
  change rebalances; `repack()` is the explicit escape hatch. Assignments are
  only frozen once `isSettled()`, or a batch of not-yet-measured appended items
  would all look like they belong in the same column and be pinned there.
- **Added `isResizing()` + move suppression** (not in the plan; came out of
  review). A window drag re-columns every frame, and a move transition retargeted
  every frame is one the items never finish — they trail behind the layout.
  Moves snap while the container's width is unsettled (150 ms debounce).
- **The reveal is sticky.** Also from review: gating item opacity on the live
  "measured at the current column width" check faded the entire masonry out and
  back in on every frame of a resize, since a column-width change un-measures
  every item for a frame. `isPositioned()` now latches on first placement.

## Carried over from the plan as specified

- Signals-first: `input()` with `numberBreakpointTransform()` (so `columnWidth`
  and `gap` take per-breakpoint maps — cdk had BehaviorSubject accessor inputs).
- `columWidth` typo fixed to `columnWidth`, and it is now a true _minimum_: the
  count is `floor((width + gap) / (columnWidth + gap))`, so columns are never
  narrower than asked for. cdk divided without counting gaps.
- Per-item `ResizeObserver` via `signalHostElementDimensions()`, using fractional
  `rect()` sizes rather than integer `offset*` so column heights don't drift.
- Fade-in on first placement; move transitions gated on
  `prefers-reduced-motion: no-preference` (cdk ignored it).
- `initializing`/`initialized` replaced by signals — one signal, `isSettled()`,
  which is also the generic replacement for the legacy-only
  `injectInfinityQueryResponseDelay` handshake (verified: that provider lives in
  `libs/query/src/lib/legacy/`, so there was nothing to keep).
- A11y: `role="list"` on the host as well as `listitem` on items; DOM order is
  reading order.
- RTL: items are anchored with `inset-inline-start` and the inline offset's sign
  flips under `:dir(rtl)`, so column 0 is the rightmost column. cdk had none.

## Verification

- 31 unit tests (17 pure layout, 14 directive-level over a faked geometry).
- Driven headlessly in Storybook: greedy stacking with no overlap in every
  column, container height = tallest column, re-columning on resize, appended
  items leaving existing placements byte-identical, single-column collapse, RTL
  column order, and no console errors. Confirmed via a `MutationObserver` frame
  log that the move transition is armed strictly after the first placement is
  painted (offsets frame 23, `data-positioned` 24, `data-can-move` 26), and that
  a stepped window drag never drops item opacity below 1 while moves snap.

## Follow-ups (not blocking)

- `form-field` is the next candidate for the styles-only-component split named in
  CLAUDE.md; masonry is another worked example of it.
- Revisit `display: grid-lanes` once it reaches Baseline.
