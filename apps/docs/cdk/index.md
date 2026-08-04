# @ethlete/cdk

The original Angular UI toolkit of the Ethlete SDK - buttons, forms, overlays, tables, carousels and more, built on [`@ethlete/core`](/core/) and integrated with [`@ethlete/query`](/query/).

::: warning Maintenance mode
`@ethlete/cdk` has been superseded by [`@ethlete/components`](/components/). It still receives bug fixes, but no new features. **Every CDK domain now has a successor** in `@ethlete/components` or `@ethlete/core` - see [the table below](#superseded-by-ethlete-components), and the callout at the top of each guide for the renames. Migrating a specific import? [**Migrating to components, symbol by symbol**](/cdk/migration) maps all 627 CDK exports to their successor. The one reason to still reach for a CDK control is **classic reactive forms**: the `@ethlete/components` form controls are signal-forms only (see [Forms](/cdk/forms)).
:::

```bash
yarn add @ethlete/cdk
```

The package peers on `@ethlete/core`, `@ethlete/query`, `@ethlete/types`, `@angular/cdk`, `@floating-ui/dom` and `date-fns`.

## Styles

Unlike `@ethlete/components` (where each component carries its own CSS), the CDK ships one global stylesheet with the structural styles for all of its components. Add it to your application's styles:

```jsonc
// project.json / angular.json
"styles": ["node_modules/@ethlete/cdk/src/lib/styles/index.css"]
```

The stylesheet is intentionally minimal - it handles layout and behavior (positioning, easing, drag-scroll cursors, the active-tab underline), not visual design. Colors, spacing and typography are yours to style via the `et-` classes each component renders.

## Interactive demos

Every component has Storybook stories under the **CDK** section:

- [`main` branch Storybook](https://ethlete-sdk.web.app/)
- [`next` branch Storybook](https://next-ethlete-sdk.web.app/)

## Migrating from v4

A consumer-facing Nx generator codemods an app from cdk v4 to v5:

```bash
yarn nx g @ethlete/cdk:migrate-to-v5
```

It runs seven transforms over your TypeScript, templates and CSS - combobox input/provider renames, `*etLet`/`*ngLet` removal, the theming move to `@ethlete/core` (color-theme class renames included), CDK-menu/`et-menu` consolidation into `MenuImports`, `IsActiveElementDirective` → `ScrollableIsActiveChildDirective`, overlay position-preset rewrites, and the dialog/bottom-sheet merge into the unified overlay (`DialogImports`/`BottomSheetImports` → `OverlayImports`). Each transform can be disabled with its own flag; review the diff afterwards. The [`@ethlete/core` v5 migration](/core/#also-in-the-package) covers the core-side renames.

## Superseded by @ethlete/components

New code should use the successor; fixes made here should usually be mirrored there. Each CDK guide below opens with the renames its successor brings.

This table is the domain-level view. For a single identifier - "what does `TableImports` / `createOverlayHandler` / `SortHeaderComponent` become?" - use the [symbol-by-symbol migration table](/cdk/migration), which covers every public CDK export and flags the three rename patterns that make a successor look like it doesn't exist.

| CDK domain                                                | Successor                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Button (`[et-button]`)                                    | [Button](/components/button)                                                                |
| Query button (`[et-query-button]`)                        | [Button](/components/button)'s `loading` input                                              |
| Overlay (dialogs, bottom sheets, responsive strategies)   | [Overlays](/components/overlays) & [Overlay openers](/components/overlay-openers)           |
| Menu                                                      | [Menu](/components/menu)                                                                    |
| Tooltip                                                   | [Tooltip](/components/tooltip)                                                              |
| Toggletip                                                 | [Toggletip](/components/toggletip)                                                          |
| Icons (`provideIcons`, `[etIcon]`)                        | [Icon](/components/icon)                                                                    |
| Scrollable                                                | [Scrollable](/components/scrollable)                                                        |
| Tabs (inline & router nav tabs)                           | [Tabs](/components/tabs)                                                                    |
| Progress spinner                                          | [Loaders](/components/loader)                                                               |
| Accordion                                                 | [Accordion](/components/accordion)                                                          |
| Bracket (`et-new-bracket`)                                | [Bracket](/components/bracket) & [Bracket rounds list](/components/bracket-rounds-list)     |
| Breadcrumb                                                | [Breadcrumb](/components/breadcrumb)                                                        |
| Carousel                                                  | [Carousel](/components/carousel)                                                            |
| Masonry                                                   | [Masonry](/components/masonry)                                                              |
| Pagination                                                | [Pagination](/components/pagination)                                                        |
| Picture                                                   | [Picture](/components/picture)                                                              |
| Skeleton                                                  | [Skeleton](/components/skeleton)                                                            |
| Table & sort                                              | [Table](/components/table)                                                                  |
| Rich filter                                               | [Floating action](/components/floating-action)                                              |
| Filter overlay (`FilterOverlayService`)                   | [Filter overlay](/components/filter-overlay)                                                |
| Query error                                               | [Query error](/components/query-error)                                                      |
| Forms (all controls)                                      | [Forms](/components/forms) and its per-family guides - **signal forms only**                |
| Utilities (dismiss checker, router state, swipe tracking) | `@ethlete/core` - see [Utilities](/core/utilities) & [Signal utilities](/core/signal-utils) |

One important difference in forms: the CDK controls integrate with **classic reactive forms** (`FormControl` / `ControlValueAccessor`), while the `@ethlete/components` controls are built for Angular's **signal forms** and have no `ControlValueAccessor` layer. If your app is still on reactive forms, the CDK form controls are the ones to use - see the [Forms guide](/cdk/forms).

## Guides

These document the CDK API as it stands. Each one names its `@ethlete/components` (or `@ethlete/core`) successor and the renames to expect up front, so a page works both as reference for an app still on the CDK and as a migration starting point.

### Floating & overlays

- [Overlays](/cdk/overlays) - dialogs, sheets and anchored popovers on one runtime: strategies, breakpoint transformations, the content shell, in-overlay routing and the sidebar layout.
- [Menu](/cdk/menu) - popup menu with roving focus, groups, checkbox/radio items and an optional search field.
- [Tooltip](/cdk/tooltip) - hover/focus label, announced via `aria-describedby`.
- [Toggletip](/cdk/toggletip) - click-triggered popover that can hold interactive content.
- [Filter overlay](/cdk/filter-overlay) - filter-sheet scaffold: edits a form copy and previews the result count before submitting.

### Data & collections

- [Table & sort](/cdk/table) - declarative Material-style table with column/row definition directives, a busy overlay and sortable headers.
- [Pagination](/cdk/pagination) - accessible page-link list driven by a `FormControl`, with optional SEO head-tag management.
- [Rich filter](/cdk/rich-filter) - scroll-aware scaffold for filter bars: swap in a floating filter button once the inline filters scroll away.
- [Query error & button](/cdk/query-error) - render `@ethlete/query` failures human-readable, and buttons that mirror a query's loading state.

### Forms

- [Forms](/cdk/forms) - reactive-forms controls: select, combobox, radio, segmented button, slider and typed inputs (date, time, number, …).

### Elements

- [Button](/cdk/button) - behavior layer for `<button>` and `<a>`: disabled handling, `type` safety and a toggle state.
- [Icons](/cdk/icons) - inline-SVG icons registered per injector with `provideIcons()`.
- [Tabs](/cdk/tabs) - inline tabs that swap projected content, and router-driven nav tabs.
- [Progress spinner](/cdk/progress-spinner) - circular indicator with determinate and indeterminate modes.

### Layout & media

- [Accordion](/cdk/accordion) - animated expandable panels with optional exclusive-open grouping.
- [Breadcrumb](/cdk/breadcrumb) - DI-based breadcrumbs: pages register templates, an outlet in the shell renders them.
- [Carousel](/cdk/carousel) - slide/fade carousel with autoplay, nav directives and a headless core.
- [Masonry](/cdk/masonry) - column-packing layout for variable-height items.
- [Picture](/cdk/picture) - responsive `<picture>` with sources, captions and priority loading.
- [Scrollable](/cdk/scrollable) - scroll container with masks, buttons, dot navigation, drag-scrolling and snapping.
- [Skeleton](/cdk/skeleton) - loading placeholders with screen-reader announcements.
- [Bracket](/cdk/bracket) - tournament brackets: single/double elimination and Swiss.

### Utilities

- [Utilities](/cdk/utilities) - navigation dismiss checker, router navigation state, swipe tracking and floating-ui placements.
