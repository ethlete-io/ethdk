# Parallel backlog - SDK base designs and early decisions, as built, archive

## SDK base designs (Tom, 2026-10-30, Q44)

A separate design session draws the SDK base parts under `.ethlete/design/sdk/` that Studio uses. It starts once
the builder's `components/button` move into the base (Q32) has landed, so both never edit the same part. Order by
use: `components/select` with the open panel and options (the 4.47 gap that blocks inherited coverage), then
`form-field` with `input` and `textarea`, then `tree`, `switch` and the tooltip. Each part declares its controls
for 4.47, goes to `ready` and waits on the merge queue for Tom. The session follows the
`ethlete-design-exploration` skill: Tom picks every design.

- **Order change (Tom, 2026-10-30):** the sdk foundations come first, then one component at a time.
- **As built (ethlete-sdk-33, 2026-10-30):** sketch `foundations/tokens` in `sdk`, round "Token overview",
  variants a (chip matrix), b (specimen), c (token sheet), at `ready` (`9f92126a3`, regenerated `5c610fb70`). Tom
  picked a (Q49); the merge is his click in Studio. `tools/scripts/generate-sdk-tokens.mjs` (`yarn sdk:tokens`,
  `--out`, `--check`) writes the token CSS from the Storybook themes with `libs/core/design/theme-css.ts` through
  `jiti`; it forces `isDefault` on both surfaces and strips the Tailwind-only output. Verified: `sketch check` ok,
  the three variant files are byte-identical to the script output. Not done: `--check` in CI, because the merged
  part only matches after the merge; the product `generated` hook is not used, because its source is a part file.
- **Next:** after Tom's merge, wire `yarn sdk:tokens --check` next to the `studio:themes` check. Q50: a small
  contrast round on the below-AA theme values (numbers go to the grill first). Then `components/select`: declare
  controls, option hover with `data-active`, option focus through `aria-activedescendant` (Q48, builder builds the
  CLI side), trigger `active` has no SDK look yet (a design question). `brand-on-light` is a later open point.
- **Token source decision (Tom, 2026-10-30, Q47, source corrected by Tom):** generate `foundations/tokens` from
  `apps/storybook/src/themes.ts` (the existing SDK brand theme, green `0 255 161`, plus `danger` and `warning`)
  and `apps/storybook/src/surface-themes.ts` (`light`, `dark`), not from `calls/components/themes.ts`. Use the
  real SDK theme generators (`libs/core/design/theme-css.ts`), through the product
  `generated` hook Studio already uses; the part only draws, no hand-kept colour CSS. Drop the Tailwind
  `--color-et-*` layer. Include `--et-shadow-color-rgb` and `--et-font-family`. Label `brand`, `danger` and
  `warning` as demo themes of this fixture: the SDK ships no theme names, the app registers them.
- **CLI gap (sent to stream A):** `design complete` checks only merged parts, so a sketch variant cannot prove
  its 4.47 coverage before the merge. Request: `design complete --variant`.
- **Active-descendant focus decision (Tom, 2026-10-30, Q48):** `design complete` accepts focus-visible evidence
  for an option that never takes DOM focus: in a shown surface, the option whose id the control's
  `aria-activedescendant` names counts when its look differs from an unforced, unselected option. Generic ARIA,
  no SDK names in `libs/cli`. No fake `:focus-visible` rule in drawings. Applies to `components/select` and later
  `tree`. **Built** in `6b6467a95`: the named option must differ in computed look from a plain sibling (not
  selected, named or forced); the gap says which evidence is missing.
- **Token overview decision (Tom, 2026-10-30, Q49, superseded by the merge):** Tom answered a (matrix of chips),
  then merged variant c (token sheet with name and value) in Studio, d40af99ed. The merge stands: the sdk token
  overview is the token sheet. Drift check: `yarn sdk:tokens:check` in CI and pre-push (9f391f97b).
- **Contrast decision (Tom, 2026-10-30, Q50):** contrast below AA in the base themes gets its own small round
  after the overview; Tom picks the new values. Measured on the first token set: `danger` hover 3.76:1, `brand`
  ink on dark 3.47:1. Re-measure on the Storybook themes first.
- **Contrast scope decisions (Tom, 2026-10-30, Q51-Q53),** on the Storybook source (53 pairs, 23 fail):
  - Q51: add `brand-on-light`, `danger-on-light` and `warning-on-light` (`apps/storybook/src/themes.ts`) to the
    sdk set; ink on a light surface uses them. No value change. Closes the `brand-on-light` open point.
  - Q52: one colour round, Tom picks the values, for all three remaining fails: on-primary on `danger` fill at
    hover/focus (3.76:1), on-primary on `warning` fill at active (3.57:1), surface `subtle` text on bg (light
    2.58:1, dark 3.78:1). Target 4.5:1; `subtle` stays visibly weaker than `muted`. Touches
    `apps/storybook/src/themes.ts`, `surface-themes.ts`, their generated `apps/storybook/src/styles/*.css`, then
    `yarn sdk:tokens`.
  - Q53: the surface border stays decorative (light 1.26:1, dark 1.73:1). A control whose only boundary is a
    border gets its own 3:1 boundary in its component design, not via the surface border.
- **As built (ethlete-sdk-33, 2026-10-30):** Tom's merge of the token sheet committed (`d40af99ed`);
  `yarn sdk:tokens:check` runs in CI and pre-push (`9f391f97b`). Sketch `foundations/tokens` "Contrast values"
  d/e/f ready (`a4ef82110`): `generate-sdk-tokens.mjs --overrides <json>` adds extra themes and patches values,
  default output unchanged. Sketch `components/select` "Select controls" a/b/c ready (`276187bd7`); exception
  request withdrawn after Q56 (`fa2bbed44`). Verified: `sketch check`, `sketch preview`, `design complete
--variant` b and c pass. Not verified by eye: the select states, the tokens states other than contrast.
- **Next (builder):** after Tom merges `foundations/tokens` e, move the e values and the three `*-on-light`
  themes into `apps/storybook/src/themes.ts`/`surface-themes.ts` and the generator default set, regenerate the
  Storybook CSS, then `yarn sdk:tokens:check` must pass against the merged CSS. After `data-et-control-part`
  lands (ethlete-sdk-57), replace the select sketch's second `data-et-control` and fake `aria-disabled`. After
  the Q54 helper lands, `foundations/colors`. Storybook is no workspace package, so it needs no changeset.

- **As built (ethlete-sdk-33, 2026-10-30):** sketch `components/form-field` round "Form field controls", variant a,
  input only, on hold (`75bf259ec`): `data-et-control` on `et-form-field`, `data-et-control-part` on the frame and
  the native input, pressed border as Q56 b, declared as `kind: 'button'` for now. Verified: `design complete
--variant a` passes. Not verified: frames by eye. `textarea()` design mock in `@ethlete/components/design/form-field`
  (`7b1011df0`, changeset patch); tsc on a scratch config, not rendered. Hold reasons: (1) `kind: 'field'` in
  progress at ethlete-sdk-57 (pointer needs hover, not active); (2) textarea rows not drawn yet; (3) `sketch check`
  contrast: `danger` label and error text 2.77:1 on light - per Q51 the rows use `danger-on-light` after Tom
  merges `foundations/colors`. Q60 (pending at the grill): drop the pressed look on text fields (recommended).
- **As built (ethlete-sdk-33, 2026-10-31):** Tom merged `foundations/colors` (`7520c12ec`). The Q57 values and the
  three `-on-light` themes are in `apps/storybook/src/themes.ts`/`surface-themes.ts`, the generator default set
  and its default `--out` is `foundations/colors/colors.css`; `yarn sdk:tokens:check` passes (`2edcd1eed`).
  Form-field: `kind: 'field'` (57, `855f4c06e`), textarea rows, no pressed look (Q61) (`827fe33d0`), errors in
  `danger-on-light` (`86788394d`); `sketch check` and `design complete --variant a` pass. After 57's per-state
  viewport fix (`e9a7ba58c`) the select open panel shows all options; select r2 d is ready again (`bbcef9574`).
  Verified by eye: both shots at 320px.
- **As built (ethlete-sdk-33, 2026-10-31):** Q65 built in `c5309a6b2` (`libs/components`, changeset, docs): an
  error only remaps the text shell's colour variables to the error theme; Q67 accepted the result. Form-field r1 a
  is ready (`27fa0a925`). Waits on Tom: merge select and form-field; discard the held `foundations/tokens` sketch,
  then `part remove foundations/tokens` and drop it from the sdk `tokens` list and studio `hideBaseParts`.
- **Next:** `components/tree`, then `switch`, then the tooltip.

- **As built (ethlete-sdk-33, 2026-10-31):** old `foundations/tokens` part removed (`7fb6b115b`). Tree mock
  (`22ff6ee3a`) and sketch `components/tree` r1 a (`56ee3fa61`, on hold). Q70: the tree focus outline uses
  `--et-theme-color-ink-solid` (`bad4fc3df`, changeset, docs); not shot yet, then release + ready the tree sketch.
- **In progress (ethlete-sdk-33, 2026-10-31):** Q68 icons, one subagent: slice 1 ships
  `libs/components/src/lib/icon/headless/*-icon.ts` to dist (ng-package assets, import-free `IconDefinition` type
  file) and replaces the inline SVG copies in `libs/components/design/*.ts`; slice 2 draws sketch
  `foundations/icons`. Cause: the design tool loads the mocks from `dist/libs/components`, which ships only
  `design/**/*.ts` and CSS, so a mock cannot import an icon file today.

- **Queued (Tom, Q71):** after Q68, new part `sdk/components/select-panel` (option grid: rest, hover,
  keyboard-active, selected, selected+hover, disabled; panel with option groups and select-all). The select part
  then composes form-field + select-panel; its open states stay only as an example. `et-select-option` is shared
  with page-size-select and phone-input.
- **As built (2026-10-31):** Tom merged `select` r2, `form-field` b and the Q86 fill round c (light filled
  field 240). Q83/Q86: `LIGHT_ELEVATED_SURFACE` background is 240; `generate-sdk-tokens.mjs` adds the light and
  dark elevated surfaces and a `[data-et-surface-fill]` rule that takes the elevated surface of the scheme, so the
  form-field part has no variant CSS. Q71 select-panel mocks and sketch r1 a; Q87/Q88: option check and
  keyboard-active outline in ink, selected option check only (patch changeset, docs, e2e). Icons: Q68 shipped
  the icon files to dist; `foundations/icons` r1 a draws with `iconSheet` (Q77/Q79). Q85: the components build
  stages `.ethlete/design/sdk` (no tsconfig, sketches, comments, accepted/merged.json) plus a `design/config.json`
  with `products.sdk` through `tools/scripts/stage-design-base.mjs`; a consumer outside the repo extends
  `node_modules/@ethlete/components/design/sdk` and passes `design check` (with the CLI fix `0126f0950`).
- **Next:** Tom merges `tree`, `select-panel` and `foundations/icons`. Then Q80: a grid round for the icons
  (the set mixes 16 px, 24 px and 512/576/640-unit grids), Tom picks, redraw the off-grid icons in
  `libs/components/src/lib/icon/headless/` with a changeset. Then `components/switch` and the tooltip. No
  Storybook or `dist/libs/components` rebuild while Tom reviews in Studio: a rebuild breaks his live canvas.

### Foundation sheet decisions (2026-10-30)

Tom asked why `sdk/foundations/tokens` looks so different from the Studio foundations. Cause: Studio draws its
five foundation parts with `studio/shared/token-sheet.ts`, reachable only through Studio's `@shared` alias; the
sdk part has its own drawing code and hand-typed value labels in `sdk/foundations/tokens/tokens.ts` next to a
generated CSS file.

- Q54: the foundation sheet helper moves into the design tool (`@design-system`, `libs/cli/design`), so every
  product (studio, sdk, studio-lab) draws its foundations with it and they look the same. Not the wireframe kit
  (`@design-system/kit`, on hold). Studio's parts switch to it; `studio/shared/token-sheet.ts` goes away.
- Q55: the sdk follows the Studio split: `foundations/colors` now, `type`, `spacing` and `motion` once the SDK
  has real values for them. Labels come from the generated CSS through the helper, never hand-typed values.
- Q54 built: `tokenSheet` is public in `@design-system` (`1ac18dd31`); Studio's four foundation parts use it, the
  sketch merged automatically with no visible change, and `studio/shared/token-sheet.ts` is gone (`acf0a439f`). The sdk
  split (Q55) is open.

### Select and contrast value decisions (2026-10-30)

- Q56 (`components/select`, round "Select controls", 276187bd7): variant b. The pressed trigger darkens the
  field border to `--et-surface-interaction-active-solid`; it differs from focus and needs no exception. Drop the
  `components/select.select.active` exception request.
- Q57 (`foundations/tokens`, round "Contrast values", a4ef82110): variant e. `danger` hover fill `185 28 28`
  (6.47:1), `danger` active fill `153 27 27` (8.31:1), `warning` active fill `251 191 36` (10.74:1; press
  lightens, accepted), surface `subtle` light `112` (4.95:1), dark `135` (4.99:1). Apply to
  `apps/storybook/src/themes.ts` and `surface-themes.ts`, regenerate the Storybook CSS, then `yarn sdk:tokens`.

### Motion, MCP and field decisions (Tom, 2026-10-30)

- Q58 (motion slice 3, `4b57f37af`): the keyframe strip stays a panel below the canvas, not a row inside it.
- Q59: the timeline driving the live frame (needs an outside switch into the frame) and token names on the
  tracks go into a later motion slice.
- Q60 (Stream B, Studio chat on `et design mcp`): one MCP server. The MCP `check` tool gets `call` and `variant`
  args, `et design check` gets `--receipt <path>` (the CLI writes the receipt `call_status.rs` reads), and a new
  MCP tool `call` returns call.ts, fixture.ts, the variant path and the frame URL. Then
  `apps/ethlete-studio/src-tauri/src/tools.rs` goes and `cli_entry` moves into `design_server.rs`.
- Q61 (`components/form-field`): `input` and `textarea` have no pressed look (hover, focus-visible and disabled
  stay); the select keeps Q56 b. Matches `kind: 'field'` (hover, no active).
- Q65 (`components/form-field`, error field showed no hover or focus change): none of the offered options. Inputs
  get no focus ring. An error only switches the field's colour theme from the normal one to the error theme
  (`injectSemanticColorTheme('error')`); hover, focus and the other states then take that theme's colours by
  themselves. Fix in `libs/components/src/lib/forms/form-field/form-field-text-shell-styles.component.css:245`:
  the `[data-error]` rule must not pin `border-color` to `--et-theme-color-primary-solid` over every state; it
  sets the theme, and the normal state rules read it. Changeset patch, docs note.

### Viewport per state (Tom feedback, 2026-10-30)

Each state is drawn in a viewport that fits that state, not one size per part. Seen on sdk `components/select`
at 320 px: the open panel is cut off at the closed trigger's height. The same holds for a field with a hint or
error versus one without, and for each size and variant of a part. Content outside the normal flow, for example an
open overlay panel, counts towards the state's size. Fix it in the tool and Studio, not per sketch.

Built in `e9a7ba58c` (`#root` grows to cover absolute and fixed content). Tom's decisions on its edges:

- Q62: a frame with a declared width does not grow sideways; a wider overlay is cut.
- Q63: content above the root (a `top` placement) is not counted; add it only when a part needs it.
- Q64: elements that fill the whole viewport (`position: fixed; inset: 0`, for example a backdrop) are skipped
  in the measure. Built in `c70713442`.
- Q66 (2026-10-31): the live Studio canvas does not fit the frame yet. After a Studio restart, select
  `open-option-hover` at 320 px is only a little taller than the closed field, and the open panel scrolls inside the
  frame. Shots are fine. `ethlete-sdk-57` fixes it now, despite the usage limit, because it blocks the select merge.
- Q69 (2026-10-31): static images in the Studio grid render in light mode while live iframes follow the dark Studio,
  so one grid (sdk button, states by interaction) mixes two colour modes. A static image always takes the colour mode
  of the live iframe. `ethlete-sdk-57` fixes it now, next to Q66, despite the usage limit. Built in `395fd54b4`.
- Q76 (2026-10-31): in light mode a shot gets an opaque white page while a live frame is transparent over the dark
  canvas. Shots get a transparent page like live frames. Later slice, after the limit reset.

### Form-field error colours decision (2026-10-31)

- Q67: accepted as built in `c5309a6b2`. In error, the field only remaps its colour variables to the error theme.
  Rest border is error primary at 50%, hover is error ink, focus-visible is error primary. Label and error text stay
  ink. No focus ring. Hover and focus-visible are close, which is fine: a keyboard user sees rest to focus-visible.
  The sdk form-field sketch goes to ready.

### SDK icons foundation decision (2026-10-31)

Tom merged sdk form-field and discarded the held `foundations/tokens` sketch. Select already builds on form-field
(`formField(...)` from `libs/components/design/form-field.ts`), so it takes form-field changes.

- Q68: new part `sdk/foundations/icons` shows every icon the SDK ships, read directly from
  `libs/components/src/lib/icon/headless/*-icon.ts`. The design drawings take their icons from the same source; the
  inline SVG copies (for example `CHEVRON_ICON_SVG` in `libs/components/design/select.ts`) go away. One source per
  icon. Built by `ethlete-sdk-33`. Drawings cannot import the headless icon files yet, because the package ships only
  `design/**/*.ts`; the packaging is fixed first.

### Tree focus ring decision (2026-10-31)

- Q70: the tree focus ring (`.et-tree-node:focus-visible`, `.et-tree-status:focus-visible` in
  `libs/components/src/lib/tree/tree.component.css`) uses `--et-theme-color-ink-solid` instead of primary. A light
  primary on a light surface gave about 1.3:1, below the 3:1 for focus indicators; ink gives about 5.5:1. The tree
  uses real DOM focus, so the ring is the only focus sign. Follows the "ink on light" rule.

### Select panel part decision (2026-10-31)

- Q71: the select's open panel gets its own part `sdk/components/select-panel`: a grid for the option (rest, hover,
  keyboard-active, selected, selected + hover, disabled), plus the panel with option groups and the select-all
  option. The select part is then form-field + select-panel; its `open` states stay only as an example of the two
  together. Same pattern as form-field: `et-select-option` is also used by page-size-select and phone-input. Built by
  `ethlete-sdk-33` after the limit reset and after the icons foundation. The select r2 d merge does not wait for it.
- Q72: the sdk form-field part shows its variants one axis at a time. Each axis gets a group of rows (appearance
  box/underline, fill transparent/filled, labelMode static/inline/floating-inside/floating-outside, size sm/md/lg);
  each row is one value with the other axes at default, with the interaction states in the columns. Not all 48
  combinations; a hard combination (for example underline + floating-inside) can come later as a single row. Select
  shows only the default variant, because its variants come from form-field. After the limit reset.
- Q73: the sdk design product ships with `@ethlete/components`. `.ethlete/design/sdk/` stays the working place in
  Studio; the build copies it into the package (for example `design/sdk/`). The drawings stay in
  `libs/components/design/`, next to their `*.design.spec.ts`, which compare drawing and real DOM. Another repo uses
  the product by pointing `"base"` in its `.ethlete/design/config.json` at the folder in `node_modules`, the same way
  `studio` uses `"base": ".ethlete/design/sdk"`. Before the build, `ethlete-sdk-33` checks what a consumer needs to
  resolve the part imports (`@design-system` from `@ethlete/cli`, `@ethlete/components/design/*`). After the limit
  reset.
- Q74: 8 shipped icons draw stroke paths without `fill="none"` and render filled (clipboard-check, floppy-disk,
  pencil, arrow-up, arrow-right, arrows-left-right, plus, underline). The real `et-icon` shows the same, so it is an
  SDK defect. Fixed in `libs/components` as a patch; then `foundations/icons` r1 a goes to ready.
- Q75: `design check --product sdk` showed 12 CONTRAST lines on button outline/tonal/transparent labels (1.0-1.33:1):
  `foundations/colors/colors.css` kept the mint ink `0 255 161` on `:root` / `.et-color--brand` under
  `prefers-color-scheme: light`. Under the light scheme `:root` takes the brand-on-light ink (`4 120 87` and its
  states), per "ink on light". The button part does not move onto `et-color--brand-on-light`; that would hide the
  defect from consumers.
- Q78: a regenerated token part (`generate-sdk-tokens.mjs` rewrites `colors.css`; CI's `sdk:tokens:check` forces the
  base change in the same commit) cannot go through a sketch. Tom accepts the "changed outside a sketch" warning for
  the Q75 commit. After the reset, `ethlete-sdk-57` adds a way to record a regenerated token part as merged.
- Q79: every kind of foundation gets one shared sheet helper in `@design-system` (`libs/cli/design`), like
  `tokenSheet`. A product passes only its data and builds no foundation layout of its own: icons, colors, type,
  spacing, motion, logo. First `iconSheet` with the views `catalogue` and `construction` (taken from
  `studio/foundations/icons`: pixel grid, centre lines, padding box), with the grid size as an input; the SDK icons
  use three grids (24 px: 25 icons, 16 px: 15, Font Awesome 512 units: 10). Studio and sdk `foundations/icons` both
  use it; sdk `foundations/icons` stays on hold until it lands. Built by `ethlete-sdk-57` after the reset.
- Q80: all SDK icons move onto one grid. After `iconSheet` lands, `ethlete-sdk-33` opens a sketch round on sdk
  `foundations/icons` with the construction view on candidate grids, and Tom picks the grid. Then the icons not on it
  are redrawn in `libs/components` (for example the Font Awesome chevron, check and times), with a changeset.

### Form-field variant rows and SDK design shipping decisions (2026-10-31)

- Q81: the sdk form-field variant rows (sketch r1) take variant b, the fields with the value "Ada Lovelace".
- Q82: the grid gets row-group headers, for example "Size" over `size-sm`, `size-md`, `size-lg`. Built by
  `ethlete-sdk-57`.
- Q83: `fill-filled` looks the same as `fill-transparent` on the light surface. `ethlete-sdk-33` finds the cause and
  shows Tom candidate light-mode fills in a sketch round; Tom picks the colour.
- Q84: a forced `focus-visible` state also sets `:focus-within` on the ancestors, so a floating label floats as in the
  real app. Built by `ethlete-sdk-57`.
- Q85: shipping the sdk design product (Q73). `ethlete-sdk-33` copies `.ethlete/design/sdk` into the package as
  `design/sdk/` (without `tsconfig.json`, `sketches/`, `comments/`, `accepted.json`, `merged.json`) plus a
  `design/config.json` with `products.sdk`, after the select-panel slice. `ethlete-sdk-57` makes the CLI default
  `render.packages` to `node_modules` when the repo has no `dist/libs` (a consumer only sets `"base"`), writes no
  generated `tsconfig.json` into a base outside the repo, and resolves `@system/*` for a base in `node_modules`. Then
  `ethlete-sdk-33` tests a consumer against a packed tarball.

### Select panel option decisions (2026-10-31)

- Q86: Tom picks the light filled-field fill (Q83 round, a 250 / b 245 / c 240 / d 235) by merging a variant in
  Studio. A sketch-round pick is never a grill question. Tom merged c: the light elevated surface background is
  240 240 240.
- Q90 (Q78, built 9d8ae9723): the product `config.json` lists generator-owned files, for example
  `"generatedFiles": ["foundations/colors/colors.css"]` (not `generated`: `DesignProduct.generated` already names
  the stylesheet generators). A base part is hashed with the base's own list. The part hash skips them, so a `yarn sdk:tokens` run never marks
  the part changed. A hand edit to `colors.ts` still does. CI `sdk:tokens:check` guards the generated file. Built by
  `ethlete-sdk-57`.
- Studio footer status (Tom, 2026-10-31): the footer gets a status line that shows the render queue (for example
  queued, rendering, slow or failed shots), so a slow or blank canvas is visible as such. Built in `d8125345d`
  (`GET /__design/queue`) and `3c02e86a1` (footer line, red "N failed" with a tooltip). Verified on an own server;
  not verified in the Tauri window.
- Studio render speed (Tom, 2026-10-31): a grid of cells must appear at once, not cell by cell. Measure first. Tom:
  "throw rust at the problem" - Rust in the Tauri host is welcome for the hot path (shot cache, render queue, image
  work, hashing) where the numbers show a gain.
- Q92: every part in Studio shows both colour schemes side by side, light and dark as two column groups, so a
  contrast fault in either scheme is visible without a switch. No toolbar switch, and no doubled `-light`/`-dark`
  states in parts. Built by `ethlete-sdk-57` (live canvas and shot route `scheme=`).
- Q80 pick (Tom merged b): all SDK icons move to the 16 px grid with 1 px padding. 16 icons are on it, 38 are
  redrawn in `libs/components` with a changeset.
- Q87: the option check icon uses the ink token (in the light scheme the brand-on-light ink), not primary mint. Same
  rule as Q75.
- Q88: a keyboard-active option gets the ink focus outline, like the tree row (Q70), so it differs from hover. A
  selected option stays check only, with no background.
- Q89: `design complete` counts the keyboard-active option look (`data-active-source="keyboard"`) as focus-visible
  for the select, menu and row kinds. No per-sketch exception. Built in `c230a42e3`: an option with
  `data-active-source="keyboard"` counts like one `aria-activedescendant` names; a `row` control with it counts
  against a plain row. Verified with a unit spec and a browser fixture (failed before the scan passed the flag on).
- Q85 consumer test (sdk-33): a product that extends a base drew without the base's tokens. Built in `0126f0950`:
  a product without `tokens` takes the base's. Verified: `design check --product app` in `/tmp/q85-consumer` gives
  `ok`. Shots there not re-checked by the builder.
