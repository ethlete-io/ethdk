import { scrollbar, scrollbarHostClass, scrollbarStyles } from '@ethlete/components/design/scrollbar';
import { definePart, drawing } from '@design-system';
import frame from './scrollbar.css?inline';

type Layout = 'vertical' | 'horizontal' | 'both' | 'rtl';

type Props = {
  layout: Layout;
  items?: number;
  scroll?: number;
  scrollInline?: number;
  visible?: boolean;
  thumb?: 'hover' | 'dragging';
};

const VIEWPORT_BLOCK = 200;
const VIEWPORT_INLINE = 432;
const INSET = 4;
const MIN_THUMB = 24;
const ROW = 36;
const CARD = 120;
const CELL_INLINE = 100;
const CELL_BLOCK = 40;
const GAP = 8;

const extent = (count: number, size: number) => count * size + (count - 1) * GAP;

const geometry = (client: number, scrollSize: number, position: number) => {
  const track = client - 2 * INSET;
  const size = Math.max(MIN_THUMB, Math.round((track * client) / scrollSize));
  const max = scrollSize - client;
  const offset = max > 0 ? Math.round(((track - size) * Math.min(position, max)) / max) : 0;

  return { size, offset };
};

const bar = (
  orientation: 'vertical' | 'horizontal',
  client: number,
  scrollSize: number,
  position: number,
  props: Props,
) => {
  const { size, offset } = geometry(client, scrollSize, position);

  return scrollbar({
    orientation,
    thumbSize: size,
    thumbOffset: offset,
    visible: props.visible,
    dragging: props.thumb === 'dragging',
    rtl: props.layout === 'rtl',
    thumbAttributes: props.thumb === 'hover' ? 'data-et-force="hover"' : undefined,
  });
};

const items = (count: number, label: string) =>
  Array.from({ length: count }, (_, index) => `<div class="scrollbar-item">${label} ${index + 1}</div>`).join('');

const render = (props: Props) => {
  const scroll = props.scroll ?? 0;
  const scrollInline = props.scrollInline ?? 0;

  if (props.layout === 'vertical') {
    const count = props.items ?? 24;

    return (
      `<div class="${scrollbarHostClass} scrollbar-viewport" data-et-skip="CLIPPED" data-layout="vertical">` +
      `<div class="scrollbar-content" style="margin-block-start: -${scroll}px">${items(count, 'Row')}</div></div>` +
      bar('vertical', VIEWPORT_BLOCK, extent(count, ROW), scroll, props)
    );
  }

  if (props.layout === 'both') {
    const columns = 12;
    const rows = 20;
    const grid = Array.from(
      { length: rows },
      (_, row) =>
        `<div class="scrollbar-grid-row">${Array.from({ length: columns }, (_, column) => `<div class="scrollbar-item">R${row + 1} C${column + 1}</div>`).join('')}</div>`,
    ).join('');

    return (
      `<div class="${scrollbarHostClass} scrollbar-viewport" data-et-skip="CLIPPED" data-layout="both">` +
      `<div class="scrollbar-content" style="margin-block-start: -${scroll}px; margin-inline-start: -${scrollInline}px">${grid}</div></div>` +
      bar('vertical', VIEWPORT_BLOCK, extent(rows, CELL_BLOCK), scroll, props) +
      bar('horizontal', VIEWPORT_INLINE, extent(columns, CELL_INLINE), scrollInline, props)
    );
  }

  const count = props.items ?? 14;

  return (
    `<div class="${scrollbarHostClass} scrollbar-viewport" data-et-skip="CLIPPED" data-layout="horizontal">` +
    `<div class="scrollbar-content" style="margin-inline-start: -${scrollInline}px">${items(count, 'Card')}</div></div>` +
    bar('horizontal', VIEWPORT_INLINE, extent(count, CARD), scrollInline, props)
  );
};

export default definePart({
  note: "Today's look",
  madeBy: ['claude-opus-5-5'],
  states: {
    vertical: { layout: 'vertical' },
    'vertical-scrolled': { layout: 'vertical', scroll: 424 },
    'vertical-end': { layout: 'vertical', scroll: 848 },
    horizontal: { layout: 'horizontal' },
    'horizontal-scrolled': { layout: 'horizontal', scrollInline: 600 },
    'both-axes': { layout: 'both', scroll: 300, scrollInline: 200 },
    rtl: { layout: 'rtl' },
    'short-content': { layout: 'vertical', items: 6, scroll: 28 },
    'long-content': { layout: 'vertical', items: 200, scroll: 3000 },
    'thumb-hover': { layout: 'vertical', scroll: 424, thumb: 'hover' },
    dragging: { layout: 'vertical', scroll: 424, thumb: 'dragging' },
    'auto-hidden': { layout: 'vertical', visible: false },
  },
  widths: [480],
  frame: (body, props) => `<div class="scrollbar-frame"${props.layout === 'rtl' ? ' dir="rtl"' : ''}>${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: `<div class="scrollbar-wrapper">${render(props)}</div>`,
      styles: [scrollbarStyles, frame].join('\n'),
    }),
});
