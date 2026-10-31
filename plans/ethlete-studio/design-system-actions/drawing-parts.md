# Open: 5. Drawing parts and pages

## 5. Drawing parts and pages

### 5.21 A sketch cannot draw another part at a sketch variant - parked

- **Pain:** the merge page needs `components/button` "after merging b". The agent faked the after
  frames with a CSS override of the radius.
- **Fix option:** an alias such as `@sketch/components/button:b`. Low priority: only drawings of
  Studio itself need it.
- **Decision (Tom, 2026-10-30):** parked. Do not build it until a second case needs it.

### 5.23 The SDK hover token draws light on Studio's dark frames - open

- **Pain:** in `components/tree-row`, `--et-surface-interaction-hover-solid` came out light grey,
  and the hovered label became unreadable. The agent used `--surface-raised` instead.
- **Fix options:** 1. a part frame gets the product's dark surface context, so SDK surface tokens
  resolve as in the app (recommended, check first why it does not). 2. `design check` warns on an
  SDK surface token in a product without that context.
- **Decision (Tom, 2026-10-30):** neither now. Treat it as a likely design issue in the SDK, not a
  Studio defect. Once Studio is ready, it is the tool that finds such SDK issues, this case
  included. No Studio workaround and no `design check` warning.

### 5.24 A component sketch does not see what its hosts draw - open

- **Pain:** `components/tree-row` was merged without the part-with-frames row and the warning
  triangle that `elements/part-tree` draws. The adoption sketch on part-tree then mapped the
  warning to "in progress" and lost the bright part row (467 px diff). It was discarded; tree-row
  gets round r2.
- **Fix options:** 1. `sketch new` on a component lists the parts whose markup it will replace, and
  the brief says to draw every case they draw (recommended, a skill rule). 2. a CLI check that
  compares the classes a host uses with the component's states.
- **Rule (Tom, 2026-10-29):** a part becomes a component only when two hosts draw the same case.
  Option 1 is in the `design-exploration` skill under "The order of a design".

### 5.31 Studio has no pressed surface token - open

- **Pain:** `tree-row`'s `:active` fill is a `color-mix` of `--surface-raised` and
  `--surface-sunken`, written in the component.
- **Fix option:** a `foundations/tokens` sketch that adds a pressed surface, once a second control
  needs a pressed state.
- **Decision (Tom, 2026-10-30):** the condition is met: `design complete` now requires an active
  state for pointer input (`e52f43d59`), and `components/disclosure` needs one. Add a
  `--surface-pressed` foundation token with the `tree-row` value
  (`color-mix(in oklch, var(--surface-raised), var(--surface-sunken) 30%)`); `tree-row` and the
  disclosure use it. It lands with the disclosure merge.
- **Reopened (2026-10-30), do not build yet:** the disclosure is already merged (`31a6708e1`,
  `7441190de`) with `color-mix(in oklch, var(--text) 10%, transparent)`. The `tree-row` value was
  nearly invisible on the toggle, which has no background at rest. Tom chooses between one
  text-tint token for any surface and two tokens.
- **Decision (Tom, 2026-10-30), replaces the first one:** one token `--surface-pressed` as a text
  tint that works on any surface, with the disclosure value
  `color-mix(in oklch, var(--text) 10%, transparent)`. `tree-row` and the disclosure use it. The
  `tree-row` press may change slightly; show Tom the before and after, and keep it visible.
- **`comment-pin` (Tom, 2026-10-30):** the pin moves to the token too. `comment-pin.css:71` and
  `:108` still mix `--surface-raised` with `--surface-sunken`; the token is a translucent text
  tint, so the move changes pixels. The pin layers the token over its face:
  `linear-gradient(var(--surface-pressed), var(--surface-pressed)), var(--surface-raised)`. A
  sketch shows before and after, with no auto-merge; Tom picks in Studio.

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
