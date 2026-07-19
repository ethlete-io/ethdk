# Grid

An interactive dashboard/widget grid — not a CSS-grid helper and not a data table. Items live on a column/row grid per breakpoint, can be dragged and resized (pointer **and** keyboard), auto-place with collision resolution and compaction, and serialize to/from a backend. Import `GridImports`.

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
<et-grid [initialItems]="items()" [rowHeight]="100" [gap]="16" (layoutChange)="persist($event)" />
```

```ts
import { GridImports } from '@ethlete/components';
```

Each `GridItemConfig` is `{ id, type, data, layout }`, where `layout` maps breakpoint names to `{ col, row, colSpan, rowSpan }` positions.

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

- **Pointer** (mouse and touch): drag items to move, drag edges/corners to resize — neighbors that fit in the vacated space swap into it, everything else is pushed down, and the layout compacts. (The gestures are built on the core [drag & resize primitives](/core/drag-resize), if you need the same behavior outside the grid.)
- **Keyboard** (on a focused item): <kbd>Ctrl/Cmd</kbd>+arrows move, <kbd>Shift</kbd>+arrows resize, <kbd>Ctrl/Cmd</kbd>+<kbd>Delete</kbd> (or <kbd>Backspace</kbd>) removes.
- Per-item span constraints come from the registration (`constraints`) or the `et-grid-item` inputs `minColSpan` / `maxColSpan` / `minRowSpan` / `maxRowSpan` (defaults `1` / `12` / `1` / `4`). Each item also takes an `ariaLabel` (default `'Grid item'`) and emits `remove` when it's removed.

## Item actions & labels

In edit mode every item renders an actions component in its top corner — by default `et-grid-item-default-actions`, a small toolbar with a remove button. Replace it globally via `provideGridConfig({ actionsComponent: MyActionsComponent })`; the component receives the item's `itemId` and `data` as inputs and can call the grid's `removeItem()` (see the `GridItemActionsComponent` type). `et-grid-item-toolbar` is the styled toolbar shell (`--et-grid-item-toolbar-*` tokens) you can reuse in a custom actions component.

`GridConfig` also carries the accessibility strings — `interactiveAriaLabel` (`'Interactive grid layout'`), `readonlyAriaLabel` (`'Grid layout'`), `removeActionAriaLabel` (`'Remove item'`) — and a `transformer(text, locale)` hook to run them through your i18n system.

## Backend integration

`layoutChange` emits a `GridSerializedState` on every edit. If your backend uses a different position shape, bridge it with `createGridAdapter`:

```ts
import { createGridAdapter } from '@ethlete/components';

const adapter = createGridAdapter<BackendWidget>({
  fromExternal: (w) => ({ id: w.uuid, type: w.kind, data: w, layout: { lg: toGridPosition(w) } }),
  toExternal: (item, position) => ({ ...item.data, ...fromGridPosition(position) }),
});
```

The `BackendIntegration` story shows the full round trip. A `<et-grid-debug />` component visualizes the underlying cells while developing.

## Accessibility

- The grid host is a `role="region"` labelled from `GridConfig` — `interactiveAriaLabel` normally, `readonlyAriaLabel` when `readOnly` (both run through the config's `transformer` for i18n).
- Each item is a focusable `role="group"` (`tabindex="0"`) with its `ariaLabel` input as the accessible name — set it per item, the default is a generic `'Grid item'`.
- All editing is keyboard-reachable (see [Interaction](#interaction)); the drag handle reflects an active drag via `aria-grabbed`, and the default remove button is labelled by `removeActionAriaLabel`.

## Theming

One public token: `--et-grid-padding` (default `0px`) pads the grid container. The default item toolbar exposes `--et-grid-item-toolbar-gap` / `-padding` / `-radius` / `-background` overrides.

## Error codes

Misplaced pieces, duplicate item ids, unregistered item types and invalid serialized states throw [`ET19xx` errors](/components/error-codes#grid-et19xx) in dev mode.
