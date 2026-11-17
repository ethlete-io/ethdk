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
  note: 'Decided rules only',
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
  describe: {
    rest: 'Four equal tiles in a 4-column grid; check the gaps and the title and subtitle in each tile.',
    spans: 'Five tiles with column and row spans; check that Visitors spans two rows and Activity the full width.',
    'item-hover': 'The Visitors tile hovered; check its hover look.',
    'item-focus-visible': 'The Visitors tile with keyboard focus; check the focus ring around the tile.',
    actions: 'The tiles with their remove actions; check that each action sits in the tile corner.',
    'action-hover': 'The Revenue remove action hovered; check its hover tint.',
    'action-focus-visible': 'The Revenue remove action with keyboard focus; check the focus ring around it.',
    dragging: 'Orders dragged off its cell with the ghost behind; check the lifted tile and the ghost cell.',
    resizing: 'Activity resized to two rows from its bottom edge; check the active edge and the new size.',
    'long-title': 'Revenue with a long title and its action; check that the title is cut before the action.',
  },
  widths: [480],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: grid({
        items: itemsOf(props),
        actions: props.actions,
        ghost: props.drag ? { col: 1, row: 1, colSpan: 1, rowSpan: 1 } : undefined,
      }),
      styles: [gridStyles, frame].join('\n'),
    }),
});
