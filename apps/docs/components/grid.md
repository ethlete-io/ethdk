# Grid

An interactive dashboard/widget grid - not a CSS-grid helper and not a data table. Items live on a column/row grid per breakpoint, can be dragged and resized (pointer **and** keyboard), auto-place with collision resolution and compaction, and serialize to/from a backend. Import `GRID_IMPORTS`.

## Registering widgets

The grid renders registered components by `type`. Register them once via `provideGridConfig`:

```ts
import { provideGridConfig } from '@ethlete/components';

providers: [
  ...provideGridConfig({
    registrations: [
      {
        type: 'chart',
        component: ChartWidgetComponent,
        constraints: { minColSpan: 3, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
      },
      { type: 'table', component: TableWidgetComponent },
    ],
  }),
],
```

## Rendering

```html
<et-grid [initialItems]="items()" (layoutChange)="persist($event)" rowHeight="100" gap="16" />
```

```ts
import { GRID_IMPORTS } from '@ethlete/components';
```

Each `GridItemConfig` is `{ id, type, data, layout }`, where `layout` maps breakpoint names to `{ col, row, colSpan, rowSpan }` positions.

Despite its name `initialItems` is a **live input**, not a one-shot seed. Every change is reconciled against what the grid already holds: new ids are placed, missing ids are removed, an empty array clears the grid, and the same ids with different positions restore those positions. Keep feeding your own signal in - there is no need to re-key the grid to make it observe a change.

Reconciliation does **not** emit `layoutChange`. That output fires only for changes made on the grid's side - a drag, a resize, a keyboard move, `addItem()` or `removeItem()` - so it can be read as "the user has unsaved edits".

## Imperative API

Get a handle with a template reference (`<et-grid #grid />`, `exportAs: 'etGrid'`) or by injecting `GRID_TOKEN`:

- `addItem(type, data)` / `removeItem(id)` - add or remove outside of the items input.
- `getSerializedState()` - the current `GridSerializedState`, the same value `layoutChange` emits.
- `restoreState(state)` - replace the whole layout with a previously serialized one. This is how you revert after a cancelled edit: snapshot with `getSerializedState()` when edit mode opens, `restoreState()` that snapshot when the user cancels. Re-feeding unchanged `initialItems` cannot do it - nothing changed, so there is nothing to reconcile.

## Live demo

<StoryEmbed id="components-grid--default" height="560px" />

## Breakpoints

Breakpoints resolve against the **container width** (not the viewport) and each defines its own column count:

```ts
// the defaults
[
  { name: 'lg', columns: 12, minWidth: 1200 },
  { name: 'md', columns: 6, minWidth: 768 },
  { name: 'sm', columns: 2, minWidth: 0 },
];
```

Override via the `breakpoints` input. `rowHeight` (default `100`) and `gap` (default `16`) control the cell geometry; `readOnly` disables all editing.

## Interaction

- **Pointer** (mouse and touch): drag items to move, drag edges/corners to resize - neighbors that fit in the vacated space swap into it, everything else is pushed down, and the layout compacts. (The gestures are built on the core [drag & resize primitives](/core/drag-resize), if you need the same behavior outside the grid.)
- **Keyboard** (on a focused item): <kbd>Ctrl/Cmd</kbd>+arrows move, <kbd>Shift</kbd>+arrows resize, <kbd>Ctrl/Cmd</kbd>+<kbd>Delete</kbd> (or <kbd>Backspace</kbd>) removes.
- Per-item span constraints come from the registration (`constraints`) or the `et-grid-item` inputs `minColSpan` / `maxColSpan` / `minRowSpan` / `maxRowSpan` (defaults `1` / `12` / `1` / `4`). Each item also takes an `ariaLabel` (default `'Grid item'`) and emits `remove` when it's removed.
- Constraints are declared once but the column count is per breakpoint, so both column spans are capped at the active breakpoint's columns: `minColSpan: 3` becomes a full-width item at the one- or two-column breakpoint rather than one wider than the grid. An item whose span cannot change on an axis grows no resize handles there - at a one-column breakpoint the whole left and right edge stays draggable instead of being covered by strips that do nothing.

## Item actions & labels

In edit mode every item renders an actions component in its top corner - by default `et-grid-item-default-actions`, a small toolbar with a remove button. Replace it globally via `provideGridConfig({ actionsComponent: MyActionsComponent })`; the component receives the item's `itemId` and `data` as inputs and can call the grid's `removeItem()` (see the `GridItemActionsComponent` type). `et-grid-item-toolbar` is the styled toolbar shell (`--et-grid-item-toolbar-*` tokens) you can reuse in a custom actions component.

The accessibility strings live in `GRID_LABELS`, not in `GridConfig` - `interactiveGrid` (`'Interactive grid layout'`), `readonlyGrid` (`'Grid layout'`) and `removeItem` (`'Remove item'`), overridable with `provideGridLabels` like [every other domain](/components/localization).

## Backend integration

`layoutChange` emits a `GridSerializedState` on every edit. If your backend uses a different position shape, bridge it with `createGridAdapter` - two functions, one per direction, each mapping a single item:

```ts
import { createGridAdapter, fromGridPosition, toGridPosition } from '@ethlete/components';

const FALLBACK_POSITION = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };

const adapter = createGridAdapter<BackendWidget>(
  (w) => ({ id: w.uuid, type: w.kind, data: w, layout: { lg: toGridPosition(w) } }),
  (item) => ({ ...(item.data as BackendWidget), ...fromGridPosition(item.layout['lg'] ?? FALLBACK_POSITION) }),
);

const items = adapter.fromExternal(widgets);
const widgetsToSave = adapter.toExternal(state.items);
```

The adapter maps one position per item, so a layout with several breakpoints has to pick which one round-trips (or map `item.layout` yourself).

The `BackendIntegration` story shows the full round trip. A `<et-grid-debug />` component visualizes the underlying cells while developing - it lives in its own `GRID_DEBUG_IMPORTS` barrel so it never reaches a production bundle.

## Accessibility

- The grid host is a `role="region"` labelled from `GRID_LABELS` - `interactiveGrid` normally, `readonlyGrid` when `readOnly` (both [localizable](/components/localization)).
- Each item is a focusable `role="group"` (`tabindex="0"`) with its `ariaLabel` input as the accessible name - set it per item, the default is a generic `'Grid item'`.
- All editing is keyboard-reachable (see [Interaction](#interaction)); the drag handle reflects an active drag via `aria-grabbed`, and the default remove button is labelled by `GRID_LABELS.removeItem`.

## Theming

One public token: `--et-grid-padding` (default `0px`) pads the grid container. The default item toolbar exposes `--et-grid-item-toolbar-gap` / `-padding` / `-radius` / `-background` overrides.

## Error codes

Misplaced pieces, duplicate item ids, unregistered item types and invalid serialized states throw [`ET19xx` errors](/components/error-codes#grid-et19xx) in dev mode.
