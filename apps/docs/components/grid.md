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

A registered component only has to declare a `data` input - the grid binds each item's `data` to it. Type it with your own payload type; no cast is needed at the registration:

```ts
@Component({ selector: 'app-chart-widget', template: '...' })
export class ChartWidgetComponent {
  data = input.required<ChartPayload>();
}
```

`GridItemConfig.data` is `unknown`, so nothing checks that an item of a given `type` actually carries the payload its component expects - that pairing is yours to keep. If every widget in an app shares one payload type, annotating the list as `GridComponentRegistration<MyPayload>[]` does enforce it: each registered component's `data` then has to read `MyPayload`.

## Rendering

```html
<et-grid [items]="items()" (layoutChange)="persist($event)" rowHeight="100" gap="16" />
```

```ts
import { GRID_IMPORTS } from '@ethlete/components';
```

Each `GridItemConfig` is `{ id, type, data, layout }`, where `layout` maps breakpoint names to `{ col, row, colSpan, rowSpan }` positions.

**The item payload type travels with the items.** `et-grid` is generic in it and infers it from what you bind, so `layoutChange`, `getSerializedState()` and `restoreState()` all speak `GridSerializedState<YourData>` - no cast on the way back out:

```ts
type WidgetData = { title: string; series: string[] };

protected widgets = signal<GridItemConfig<string, WidgetData>[]>([]);

protected persist(state: GridSerializedState<WidgetData>) {
  // state.items[0].data.title is typed
}
```

`items` is a **live input**, not a one-shot seed. Every change is reconciled against what the grid already holds: new ids are placed, missing ids are removed, an empty array clears the grid, and the same ids with different positions restore those positions. Keep feeding your own signal in - there is no need to re-key the grid to make it observe a change.

Reconciliation does **not** emit `layoutChange`. That output fires only for changes made on the grid's side - a drag, a resize, a keyboard move, `addItem()` or `removeItem()` - so it can be read as "the user has unsaved edits".

## Writing the items yourself

A registration renders a widget **by type**, which is what a dashboard whose widget set arrives from a backend needs. When the widgets are known where you write the template, project an `et-grid-item` per item instead and skip registrations entirely - the grid positions, drags, resizes and serializes a projected item exactly like a stamped one:

```html
<et-grid [items]="widgets()" (layoutChange)="persist($event)">
  @for (widget of widgets(); track widget.id) {
  <et-grid-item [itemId]="widget.id" [ariaLabel]="widget.data.title">
    <app-widget-header [title]="widget.data.title" />
  </et-grid-item>
  }
</et-grid>
```

The `items` input still owns the layout - projection only supplies the markup, so an item you project but never list in `items` has no position and is never placed. `itemId` is what ties the two together.

**Each item must be rendered by exactly one of the two mechanisms.** An item whose type has a registration _and_ a projected `et-grid-item` renders twice, stacked perfectly so the duplicate is invisible - dev mode throws [`ET1905`](/components/error-codes#grid-et19xx) rather than let it through. Mixing the two in one grid is fine as long as you project only the items whose type is unregistered. An item covered by neither renders nothing, which is [`ET1904`](/components/error-codes#grid-et19xx).

The per-item inputs (`ariaLabel`, `minColSpan` / `maxColSpan` / `minRowSpan` / `maxRowSpan`, `perBreakpointConstraints`, the `remove` output) are only reachable this way - the grid's own loop binds `itemId` and nothing else, so a registered widget takes its constraints from the registration.

## Imperative API

Get a handle with a template reference (`<et-grid #grid />`, `exportAs: 'etGrid'`) or by injecting `GRID_TOKEN`:

- `addItem(type, data)` / `removeItem(id)` - add or remove outside of the `items` input.
- `currentItems()` - what the grid holds right now: the `items` input reconciled with every drag, resize, `addItem()` and `removeItem()` since.
- `getSerializedState()` - the current `GridSerializedState`, the same value `layoutChange` emits.
- `restoreState(state)` - replace the whole layout with a previously serialized one. This is how you revert after a cancelled edit: snapshot with `getSerializedState()` when edit mode opens, `restoreState()` that snapshot when the user cancels. Re-feeding unchanged `items` cannot do it - nothing changed, so there is nothing to reconcile.

## Live demo

<StoryEmbed id="components-layout-grid--default" height="560px" />

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

If the items come from a backend, declare the breakpoints in the adapter instead and bind `adapter.breakpoints` - see [Backend integration](#backend-integration).

## Interaction

- **Pointer** (mouse and touch): drag items to move, drag edges/corners to resize - neighbors that fit in the vacated space swap into it, everything else is pushed down, and the layout compacts. (The gestures are built on the core [drag & resize primitives](/core/drag-resize), if you need the same behavior outside the grid.)
- **Keyboard** (on a focused item): <kbd>Ctrl/Cmd</kbd>+arrows move, <kbd>Shift</kbd>+arrows resize, <kbd>Ctrl/Cmd</kbd>+<kbd>Delete</kbd> (or <kbd>Backspace</kbd>) removes. Keys typed into a form field or contenteditable inside the item stay with that field - a widget with an input never resizes on <kbd>Shift</kbd>+arrow.
- A gesture the **browser** takes away mid-drag - a system back gesture, an incoming call, the tab going to the background - reverts like <kbd>Escape</kbd> rather than dropping the item where the pointer happened to be. Same for a resize.
- Per-item span constraints are three layers, narrowest last: the built-in defaults (`1` / `12` / `1` / `24`), the registration's `constraints` for the item's `type`, then whatever the `et-grid-item` inputs `minColSpan` / `maxColSpan` / `minRowSpan` / `maxRowSpan` set. Each input is unset unless you write it, so narrowing one bound of a registered type leaves the other three as the registration declared them. Each item also takes an `ariaLabel` (default `'Grid item'`) and emits `remove` when it's removed. See [Per-breakpoint constraints](#per-breakpoint-constraints) for bounds that differ by breakpoint.
- Both column spans are capped at the active breakpoint's column count, so `minColSpan: 3` becomes a full-width item at the one- or two-column breakpoint rather than one wider than the grid. An item whose span cannot change on an axis grows no resize handles there - at a one-column breakpoint the whole left and right edge stays draggable instead of being covered by strips that do nothing.
- The resize strips reach **into the gap** as well as into the item, by half the gap up to 8px - so at the default `gap: 16` an edge is a 14px target rather than 6px, and the hover marker has not moved. The gap is split evenly between the two items either side of it. Nothing changes inside the item, so the strips never cover content or a scrollbar; shrink `gap` and the outward half shrinks with it.

## Per-breakpoint constraints

A bound that should differ by breakpoint - two columns wide at `md`, full width at `sm` - goes in `perBreakpoint`, next to the base bounds. Both the registration and the item accept it:

```ts
provideGridConfig({
  registrations: [
    {
      type: 'chart',
      component: ChartWidgetComponent,
      constraints: {
        minColSpan: 4,
        maxColSpan: 12,
        perBreakpoint: {
          md: { minColSpan: 3, maxColSpan: 6 },
          sm: { minColSpan: 2, maxColSpan: 2 },
        },
      },
    },
  ],
});
```

```html
<et-grid-item [itemId]="item.id" [perBreakpointConstraints]="{ sm: { maxColSpan: 1 } }">…</et-grid-item>
```

The rules:

- **The merge is per key.** A breakpoint the override does not name keeps the base bound, so `{ sm: { maxColSpan: 1 } }` leaves the three other bounds alone.
- **The layers still apply.** For one breakpoint, narrowest last: the defaults, the registration's base bounds, the registration's override for that breakpoint, the item's inputs, the item's override for that breakpoint. What you write on the element always beats what the registration declares.
- **Capping happens anyway.** Column spans are still capped to the breakpoint's column count, so you only need an override for what the cap cannot say - a _different_ span where the grid is wide enough for the base one. `minColSpan: 3` already degrades to full width at a two-column breakpoint on its own.
- **A stored position is refitted, not trusted.** When the grid moves to a breakpoint it refits every item to that breakpoint's bounds and compacts, so a saved layout from before you narrowed a bound corrects itself. A minimum only grows an item whose `et-grid-item` has initialised - an item added mid-session is 1×1 for one frame, and growing it then would fight its own registration.
- **Re-registering an equal config is a no-op**, compared by value, so an object literal written inline in the template is safe.

Read the effective bounds with `getConstraints(id)` for the active breakpoint, or `getConstraintsForBreakpoint(id, name)` for another one.

## Item actions & labels

In edit mode every item renders an actions component in its top corner - by default `et-grid-item-default-actions`, a small toolbar with a remove button. Replace it globally via `provideGridConfig({ actionsComponent: MyActionsComponent })`; the component receives the item's `itemId` and `data` as inputs and can call the grid's `removeItem()` (see the `GridItemActionsComponent` type). As with a registered widget, `data` can be typed with your own payload type - declare `itemId = input.required<string>()` and `data = input.required<MyPayload>()`, no cast needed. `et-grid-item-toolbar` is the styled toolbar shell (`--et-grid-item-toolbar-*` tokens) you can reuse in a custom actions component.

The accessibility strings live in `GRID_LABELS`, not in `GridConfig` - `interactiveGrid` (`'Interactive grid layout'`), `readonlyGrid` (`'Grid layout'`) and `removeItem` (`'Remove item'`), overridable with `provideGridLabels` like [every other domain](/components/localization).

## Backend integration

`layoutChange` emits a `GridSerializedState` on every edit. If your backend uses a different position shape, bridge it with `createGridAdapter` - one mapper per direction, each mapping a single item, both typed against the breakpoints you declare:

```ts
import { createGridAdapter, fromGridPosition, mapGridLayout, toGridPosition } from '@ethlete/components';

const adapter = createGridAdapter({
  breakpoints: {
    lg: { columns: 12, minWidth: 1200 },
    md: { columns: 6, minWidth: 768 },
    sm: { columns: 2, minWidth: 0 },
  },
  fromExternal: (w: BackendWidget) => ({
    id: w.uuid,
    type: w.kind,
    data: { title: w.title },
    layout: mapGridLayout(w.layout, toGridPosition),
  }),
  toExternal: (item) => ({
    uuid: item.id,
    kind: item.type,
    title: item.data.title,
    layout: mapGridLayout(item.layout, fromGridPosition),
  }),
});

const items = adapter.fromExternal(widgets);
const widgetsToSave = adapter.toExternal(state.items);
```

`breakpoints` is keyed by breakpoint name, and those names are the single source of truth for the whole round trip:

- Bind `adapter.breakpoints` into the grid's `breakpoints` input - it is the same declaration, already in the `{ name, columns, minWidth }` shape - so the names the adapter maps and the names the grid resolves cannot drift.
- Both mappers' `layout` is a **total** record over them. A breakpoint the mapping forgets is a compile error, and so is an unknown one - so neither direction needs a fallback position for a key that might not be there.
- `mapGridLayout` maps a whole layout record through one function, keeping the keys - use it in either direction instead of repeating the position mapping per breakpoint. `toGridPosition` / `fromGridPosition` convert a backend `{ x, y, cols, rows }` to a `GridItemPosition` and back.

The item payload type is inferred from what `fromExternal` returns as `data`, so `item.data` is typed in the reverse mapper without naming it anywhere. `toExternal` takes what `layoutChange` hands you (`state.items`) as-is.

A `layout` is expected to hold one position per configured breakpoint. An omitted one is not an error - the item is auto-placed there, in item order - but that arrangement ignores the positions the layout _does_ carry, so a layout covering only some breakpoints reads as the grid having lost the others. The grid warns about that in dev mode, naming the item and the breakpoints it is missing. An adapter cannot produce such an item, and neither can the grid: every item it places gets a position on every breakpoint.

An empty `layout: {}` says "place this for me" and never warns - it is what `addItem` itself passes. It is also why `mapGridLayout` is the mapper to reach for over reading `item.layout.lg` yourself: an item you just added and have not saved a placement for yet maps to an empty layout rather than to an invented position.

The `BackendIntegration` story shows the full round trip. A `<et-grid-debug />` component visualizes the underlying cells while developing - it lives in its own `GRID_DEBUG_IMPORTS` barrel so it never reaches a production bundle.

## Accessibility

- The grid host is a `role="region"` labelled from `GRID_LABELS` - `interactiveGrid` normally, `readonlyGrid` when `readOnly` (both [localizable](/components/localization)).
- Each item is a focusable `role="group"` (`tabindex="0"`) with its `ariaLabel` input as the accessible name - set it per item, the default is a generic `'Grid item'`. A keyboard-focused item draws an inset ring in `--et-theme-color-primary-solid` (`:focus-visible` only - a pointer press leaves no ring).
- All editing is keyboard-reachable (see [Interaction](#interaction)); the drag handle reflects an active drag via `aria-grabbed`, and the default remove button is labelled by `GRID_LABELS.removeItem`.

## Theming

`--et-grid-padding` (default `0px`) pads the grid container. Each item resolves
`--et-grid-item-radius` (default `0`) and `--et-grid-item-bg` (default
`--et-surface-background-solid`) for its own box, and `--et-grid-item-resize-handle-color`
(default `--et-surface-color-solid`) for the resize handles. The default item toolbar exposes
`--et-grid-item-toolbar-gap` / `-padding` / `-radius` / `-background` overrides.

## Error codes

Misplaced pieces, duplicate item ids, items nothing renders (or two things render), and invalid serialized states throw [`ET19xx` errors](/components/error-codes#grid-et19xx) in dev mode.
