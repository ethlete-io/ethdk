# Open: 5. Drawing parts and pages

## 5. Drawing parts and pages

### 5.21 A sketch cannot draw another part at a sketch variant - parked

- **Pain:** the merge page needs `components/button` "after merging b". The agent faked the after
  frames with a CSS override of the radius.
- **Fix option:** an alias such as `@sketch/components/button:b`. Low priority: only drawings of
  Studio itself need it.
- ADR 0152: [A sketch cannot draw another part at a sketch variant, parked](../../../apps/ethlete-studio/docs/adr/0152-a-sketch-cannot-draw-another-part-at-a-sketch-variant-parked.md)

### 5.23 The SDK hover token draws light on Studio's dark frames - open

- **Pain:** in `components/tree-row`, `--et-surface-interaction-hover-solid` came out light grey,
  and the hovered label became unreadable. The agent used `--surface-raised` instead.
- **Fix options:** 1. a part frame gets the product's dark surface context, so SDK surface tokens
  resolve as in the app (recommended, check first why it does not). 2. `design check` warns on an
  SDK surface token in a product without that context.
- ADR 0153: [A light SDK hover token on dark frames is an SDK design issue](../../../apps/ethlete-studio/docs/adr/0153-a-light-sdk-hover-token-on-dark-frames-is-an-sdk-design-issue.md)

### 5.24 A component sketch does not see what its hosts draw - open

- **Pain:** `components/tree-row` was merged without the part-with-frames row and the warning
  triangle that `elements/part-tree` draws. The adoption sketch on part-tree then mapped the
  warning to "in progress" and lost the bright part row (467 px diff). It was discarded; tree-row
  gets round r2.
- **Fix options:** 1. `sketch new` on a component lists the parts whose markup it will replace, and
  the brief says to draw every case they draw (recommended, a skill rule). 2. a CLI check that
  compares the classes a host uses with the component's states.
- ADR 0154: [A part becomes a component only when two hosts draw the same case](../../../apps/ethlete-studio/docs/adr/0154-a-part-becomes-a-component-only-when-two-hosts-draw-the-same-case.md)

### 5.31 Studio has no pressed surface token - open

- **Pain:** `tree-row`'s `:active` fill is a `color-mix` of `--surface-raised` and
  `--surface-sunken`, written in the component.
- **Fix option:** a `foundations/tokens` sketch that adds a pressed surface, once a second control
  needs a pressed state.
- ADR 0155: [A pressed surface token with the tree-row value](../../../apps/ethlete-studio/docs/adr/0155-a-pressed-surface-token-with-the-tree-row-value.md)
- **Reopened (2026-10-30), do not build yet:** the disclosure is already merged (`31a6708e1`,
  `7441190de`) with `color-mix(in oklch, var(--text) 10%, transparent)`. The `tree-row` value was
  nearly invisible on the toggle, which has no background at rest. Tom chooses between one
  text-tint token for any surface and two tokens.
- ADR 0156: [The pressed surface token is a text tint for any surface](../../../apps/ethlete-studio/docs/adr/0156-the-pressed-surface-token-is-a-text-tint-for-any-surface.md)
- ADR 0157: [The comment pin uses the pressed token over its face](../../../apps/ethlete-studio/docs/adr/0157-the-comment-pin-uses-the-pressed-token-over-its-face.md)

### 5.32 A page cannot reuse the canvas frame chrome - open

- **Pain:** `pages/system` "Many states": `elements/canvas-frames` exports only the fixed button
  frames, so the agent copied the frame head, frame box and zoom chip CSS into the sketch's
  `shared/`.
- **Fix option:** a sketch on `elements/canvas-frames` that exports frame head, frame box and zoom
  chip as named parts.

Also seen again in "Many states": 3.27 (`sketch.json` not Prettier-clean) and 4.30 (shot path).

### 5.51 No contrast numbers next to colour tokens - open

- **Pain:** the warning sketch agent wrote its own oklch-to-sRGB and WCAG script, because the raw
  `.et-color--*` vars take rgb triplets and the Studio aliases are oklch.
- **Fix options:** 1. the tokens drawing prints the contrast ratio of each colour token against
  each surface (recommended; it reads computed styles already). 2. a `design contrast <fg> <bg>`
  command.
