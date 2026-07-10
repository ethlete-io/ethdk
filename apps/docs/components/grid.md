# Grid

An interactive dashboard/widget grid — not a CSS-grid helper and not a data table. Items live on a column/row grid per breakpoint, can be dragged and resized (pointer **and** keyboard), auto-place with collision resolution and compaction, and serialize to/from a backend. Import `GridImports`.

## Registering widgets

The grid renders registered components by `type`. Register them once via `provideGridConfig`:

```ts
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

- **Pointer**: drag items to move, drag edges/corners to resize — collisions push neighbors and the layout compacts.
- **Keyboard** (on a focused item): <kbd>Ctrl/Cmd</kbd>+arrows move, <kbd>Shift</kbd>+arrows resize, <kbd>Ctrl/Cmd</kbd>+<kbd>Delete</kbd> removes.
- Per-item span constraints come from the registration (`constraints`) or the `et-grid-item` inputs (`minColSpan`, `maxColSpan`, `minRowSpan`, `maxRowSpan`).

## Backend integration

`layoutChange` emits a `GridSerializedState` on every edit. If your backend uses a different position shape, bridge it with `createGridAdapter`:

```ts
const adapter = createGridAdapter<BackendWidget>({
  fromExternal: (w) => ({ id: w.uuid, type: w.kind, data: w, layout: { lg: toGridPosition(w) } }),
  toExternal: (item, position) => ({ ...item.data, ...fromGridPosition(position) }),
});
```

The `BackendIntegration` story shows the full round trip. A `<et-grid-debug />` component visualizes the underlying cells while developing.
