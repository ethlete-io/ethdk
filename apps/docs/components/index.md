# @ethlete/components

The active Angular UI library of the Ethlete SDK — overlays, menus, buttons, forms, tabs, tooltips and more. Components are built signal-first, styled with plain CSS on top of the SDK's surface/color theming systems, and structured in three tiers (primitives → headless directives → default components).

::: info Components vs CDK
`@ethlete/components` supersedes [`@ethlete/cdk`](/cdk/), which is in maintenance mode. New UI work happens here.
:::

::: warning Theme names are project-specific
Components take `color` / `surface` inputs, but the theme **names** are registered by your app (via the [surface/color theming providers](/core/theming)), not shipped by the SDK. Wherever these guides use names like `color="brand"` or `danger`, those are the themes this repo's Storybook registers — substitute your own. Semantic behavior (e.g. destructive menu items, form errors) resolves themes by `type` (like `type: 'error'`), so register one theme per semantic type you use.
:::

## Overriding component styles

Component styles ship inside the `components` CSS cascade layer (`@layer components`).
Tailwind v4 orders that layer before `utilities`, so **you can override layout,
spacing and sizing with plain utility classes — no `!important` needed**:

```html
<button class="flex w-full" et-button>Full width</button>
```

The same holds for your own CSS: any rule that is unlayered or in a later layer
wins over component styles by default. If your app customizes its cascade layer
order, make sure `components` sorts before your utilities layer (the default
Tailwind v4 order — `theme, base, components, utilities` — already does).

For fine-grained, semantic customization, prefer each component's `--et-*` custom
property tokens (documented per component, e.g. [Button](/components/button)) and
the [surface/color theming](/core/theming) systems over ad-hoc overrides.

## Interactive demos

Every component ships with Storybook stories — the primary place to explore rendered components:

- [`main` branch Storybook](https://ethlete-sdk.web.app/)
- [`next` branch Storybook](https://next-ethlete-sdk.web.app/)

The written guides below cover the code-first APIs (utilities, patterns, architecture) that a component canvas can't explain well, and embed the relevant stories where a live demo helps.

## Guides

### Floating & overlays

- [Overlays](/components/overlays) — the overlay system: opening dialogs and sheets, content structure, responsive strategies, declarative popovers, and routing inside overlays.
- [Overlay openers](/components/overlay-openers) — defining overlays, opening them from code or templates, config merging, and URL-driven (query param) overlays.
- [Menu](/components/menu) — dropdown, context and submenus with keyboard navigation, selection and search.
- [Tooltip](/components/tooltip) — hover/focus-triggered descriptive text.
- [Toggletip](/components/toggletip) — click-triggered popovers with interactive content.

### Elements

- [Button](/components/button) — surface, text, icon, FAB and window-control buttons with loading and pressed states.
- [Calendar](/components/calendar) — inline month calendar with single and range selection, min/max bounds and full keyboard grid navigation.
- [Chip](/components/chip) — compact pill for a value, tag or filter with an optional remove button.
- [Icon](/components/icon) — tree-shakeable inline-SVG icons via `provideIcons()` and `[etIcon]`.
- [Loaders](/components/loader) — spinner, progress bar and brand loader.
- [Time picker](/components/time-picker) — inline column-list time picker with a format-derived layout (12/24h, seconds) and per-column keyboard selection.

### Forms

- [Forms overview](/components/forms) — the shared field shell (labels, hints, errors, affixes), signal-forms binding, validation, bulk editing and theming that every control inherits.
- [Text inputs](/components/text-inputs) — text field, number, password, textarea, color, masked input, OTP, tag and phone.
- [Date & time inputs](/components/date-time-inputs) — date, date range, time, date-time and duration controls with typed entry plus anchored pickers.
- [Choice & rating](/components/choice-inputs) — checkbox, switch, radio/checkbox/segmented selection lists and the star rating.
- [Select](/components/select) — combobox-pattern dropdown select with keyboard navigation, typeahead and virtual option focus.
- [Cascader](/components/cascader) — browse a hierarchy level by level (Miller columns / mobile drill) from an abstract, lazily-loaded data source.
- [Slider](/components/slider) — single-value and two-thumb range sliders with pointer drag, a full keyboard model and RTL support.
- [Rich text editor](/components/rich-text-editor) — Markdown-valued `contenteditable` editor with a data-driven toolbar, tables, `#`/`@` trigger tokens and a multi-language variant.
- [Dropzone](/components/dropzone) — file-upload form control with a built-in @ethlete/query upload workflow, previews, progress and retry.
- [Mixed state](/components/mixed-state) — the bulk-editing contract shared by every value control.

### Layout & structure

- [Bracket](/components/bracket) — tournament bracket renderer for single/double-elimination and swiss stages, with SVG connectors, journey highlighting and pluggable match/header cards.
- [Grid](/components/grid) — drag & resize dashboard grid with breakpoints, keyboard editing and backend serialization.
- [Scrollable](/components/scrollable) — scroll containers with buttons, masks, snap and drag scrolling.
- [Table](/components/table) — type-safe, light-by-default data table on CSS grid with a sticky header and empty state.
- [Tabs](/components/tabs) — content tabs and router-driven nav tabs.

### Feedback & media

- [Notification](/components/notification) — toast system with live-updating refs, actions and per-status durations.
- [Stream](/components/stream) — embedded players for eight platforms with consent gating and picture-in-picture.

### Utilities

- [Focus ring](/components/focus-ring) — the shared keyboard-focus outline for custom interactive elements.
- [Query devtools](/components/query-devtools) — in-app inspector for the `@ethlete/query` system (queries, stacks, sequences, auth, cache, events).
- [Error codes](/components/error-codes) — every `ETxxxx` runtime error, what causes it and how to fix it.
