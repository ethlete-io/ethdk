import { grid, GridMockItem, gridStyles } from '@ethlete/components/design/grid';
import { definePart, drawing } from '@design-system';
import frame from './grid.css?inline';

type Props = {
  layout: 'rest' | 'spans';
  actions?: boolean;
  item?: Partial<GridMockItem> & { id: string };
  drag?: boolean;
  resize?: boolean;
  longTitle?: boolean;
};

const REST: (GridMockItem & { id: string })[] = [
  { id: 'revenue', col: 0, row: 0, colSpan: 2, rowSpan: 1, title: 'Revenue', subtitle: 'Last 30 days' },
  { id: 'visitors', col: 2, row: 0, colSpan: 2, rowSpan: 1, title: 'Visitors', subtitle: 'This week' },
  { id: 'orders', col: 0, row: 1, colSpan: 2, rowSpan: 1, title: 'Orders', subtitle: 'Today' },
  { id: 'refunds', col: 2, row: 1, colSpan: 2, rowSpan: 1, title: 'Refunds', subtitle: 'Today' },
];

const SPANS: (GridMockItem & { id: string })[] = [
  { id: 'revenue', col: 0, row: 0, colSpan: 2, rowSpan: 1, title: 'Revenue', subtitle: 'Last 30 days' },
  { id: 'visitors', col: 2, row: 0, colSpan: 2, rowSpan: 2, title: 'Visitors', subtitle: 'This week' },
  { id: 'orders', col: 0, row: 1, colSpan: 1, rowSpan: 1, title: 'Orders', subtitle: 'Today' },
  { id: 'refunds', col: 1, row: 1, colSpan: 1, rowSpan: 1, title: 'Refunds', subtitle: 'Today' },
  { id: 'activity', col: 0, row: 2, colSpan: 4, rowSpan: 1, title: 'Activity', subtitle: 'Latest events' },
];

const LONG_TITLE = 'Revenue by region and sales channel';

const itemsOf = (props: Props) => {
  const items = (props.layout === 'rest' ? REST : SPANS).map((item) =>
    props.item?.id === item.id ? { ...item, ...props.item } : item,
  );

  if (props.drag) {
    return items.map((item) => {
      if (item.id === 'orders') return { ...item, state: 'dragging' as const, offset: { x: 70, y: 18 } };
      if (item.id === 'refunds') return { ...item, col: 0 };
      return item;
    });
  }

  if (props.resize) {
    return items.map((item) =>
      item.id === 'activity' ? { ...item, rowSpan: 2, state: 'resizing' as const, activeEdge: 's' as const } : item,
    );
  }

  if (props.longTitle) return items.map((item) => (item.id === 'revenue' ? { ...item, title: LONG_TITLE } : item));

  return items;
};

export default definePart({
  note: "The SDK grid (et-grid, et-grid-item, et-grid-item-toolbar, et-grid-item-default-actions), first drawing, drawn by its mock from @ethlete/components/design/grid with the real markup and CSS: grid, grid item, item toolbar and default actions sheets, the et-resize-handles sheet (via @ethlete/core/design/resize-handles) and the xs transparent et-icon-button for remove. Items are laid out by a copy of the lib's grid maths. Framed as a 480px page with 16px padding; 448px content, 4 columns (a consumer breakpoint, the default at this width would be 2), rowHeight 100 and gap 16 (the defaults), so a 1x1 cell is 100 x 100. Items take the next surface elevation, as the lib does. The item content (title and muted subtitle) is consumer content, drawn by the mock. States: rest (four 2x1 items), spans (2x1, 2x2, 1x1, 1x1, 4x1), item-hover (the 2x2 item: the eight resize bars and pips), item-focus-visible (same item), actions (a registered actionsComponent: the remove button in every item), action-hover and action-focus-visible (remove on the first item), dragging (the Orders tile lifted 70 / 18 px off its slot, Refunds moved into its slot, the drop placeholder at the target slot), resizing (Activity grown to 4x2 by its south edge: every handle shown), long-title (a long first title with actions). Static snapshot: the move, enter and settle transitions drawn at rest. The lib has no empty state (an empty grid is 0px high) and no loading state, so neither is drawn. Numbers (light / dark), from shot pixels at scale 2, brand mint, a: item fill vs page 1.14 / 1.18; item focus ring (2px inset outline, primary) vs the item fill 1.16 / 11.40 (vs page 1.33 / 13.50); remove button focus ring (et-focus-ring, primary) vs fill 1.16 / 11.40; remove icon at rest (muted) vs fill 6.86 / 5.86, on hover (surface colour) vs its tint 15.31 / 12.07; remove hover tint vs fill 1.03 / 1.20; resize bars and pips (surface colour at 20 % opacity) vs fill 1.51 / 1.88; drop placeholder: dashed edge vs page 1.80 / 2.29, fill vs page 1.17 / 1.23. Q98 numbers only: the item has no edge, so its fill alone sets it off the page (1.14 / 1.18); the placeholder edge 1.80 / 2.29. Decided rules that arise: Q88 (the item focus ring and the remove button focus ring). Q99a does not arise: the only mint marks are the two focus rings, which Q88 covers; the remove hover tint is an interaction tint, kept. No mint fill, so no ink edge, so Q102 does not arise and there is no c. Q101 does not arise: no filled button. Findings for later, not render refusals: the actions slot is absolutely positioned over the item's top right corner and reserves no space, so a long title runs under the remove button (long-title); the active resize edge has no style of its own (data-active-edge is set, nothing reads it), so a resize looks like a hover; the dragged item has no lift (no shadow or scale) and reads flat over its neighbours; the resize bars sit at 1.51 vs the fill on light. Later rounds, left out here: read-only, touch handle sizes, keyboard move and resize feedback, the enter and leave fade, the grid padding, per-item radius and background tokens, a custom actions component.",
  madeBy: ['claude-opus-5-5'],
  states: {
    rest: { layout: 'rest' },
    spans: { layout: 'spans' },
    'item-hover': { layout: 'spans', item: { id: 'visitors', force: 'hover' } },
    'item-focus-visible': { layout: 'spans', item: { id: 'visitors', force: 'focus-visible' } },
    actions: { layout: 'spans', actions: true },
    'action-hover': { layout: 'spans', actions: true, item: { id: 'revenue', removeForce: 'hover' } },
    'action-focus-visible': { layout: 'spans', actions: true, item: { id: 'revenue', removeForce: 'focus-visible' } },
    dragging: { layout: 'spans', drag: true },
    resizing: { layout: 'spans', resize: true },
    'long-title': { layout: 'spans', actions: true, longTitle: true },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${grid({
        items: itemsOf(props),
        actions: props.actions,
        ghost: props.drag ? { col: 1, row: 1, colSpan: 1, rowSpan: 1 } : undefined,
      })}</div>`,
      styles: [gridStyles, frame].join('\n'),
    }),
});
