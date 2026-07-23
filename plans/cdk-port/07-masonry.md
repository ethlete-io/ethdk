# 07 — Masonry

**Status: planned, not started.** Size: M. Research done 2026-07-23 against
`libs/cdk/src/lib/components/masonry/` (~580 lines). Net-new in
`libs/components`.

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

## Rewrite decisions

- **Check CSS-first options before porting the JS engine** (implementation
  spike): native CSS masonry (`grid-template-rows: masonry` / the newer
  `display: masonry` proposal) and `columns` were not viable when cdk was
  written — verify current browser support against the repo's baseline. CSS
  `columns` gives column-major order (visual order ≠ DOM order) which is
  usually wrong for feeds; native grid masonry support is likely still
  insufficient. **Expected outcome: keep a JS engine**, but decide with
  evidence and record it here.
- If JS: rewrite the engine signals-first (drop the BehaviorSubject/RxJS
  orchestration), keep the good parts — greedy shortest-column, partial
  invalidation for appended items (important for infinite scroll), fade-in on
  first position, transform transitions (gated by `prefers-reduced-motion`,
  which cdk ignores).
- **Fix the API**: signal inputs `columnWidth` (fix the `columWidth` typo),
  `gap`; keep required per-item `key`; `initialized`/`initializing` as
  signals rather than (or in addition to) outputs.
- **Measurement**: use `ResizeObserver` per item (via core's
  `signalElementDimensions`) instead of one-time `getBoundingClientRect`
  snapshots — cdk doesn't reflow when an _item's own_ content resizes
  (images loading late change heights); that's a known-class bug to fix.
- **Keep the infinite-scroll handshake** (`injectInfinityQueryResponseDelay`)
  — but verify it exists/makes sense for the current query client; if it's
  legacy-only, provide the equivalent for the current client or make the
  hook generic (a `settled` signal consumers can gate fetches on).
- A11y: `role="list"` on the host (cdk only sets `listitem` on items), and
  ensure DOM order = reading order (JS masonry preserves it; another reason
  against CSS `columns`).
- Styling: near-zero — structural CSS only, wrapped in `@layer components`.

## Deliverables

Component + item (headless split where sensible), stories (random-height
cards, append/infinite scroll, resize), docs page
(`apps/docs/components/masonry.md`), changeset. cdk masonry stays untouched.
