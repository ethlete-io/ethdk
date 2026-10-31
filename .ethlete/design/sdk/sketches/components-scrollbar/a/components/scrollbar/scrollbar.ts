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
  note: "The SDK scrollbar (et-scrollbar), drawn by its mock from @ethlete/components/design next to a scroll container with the et-scrollbar-host class (native bar hidden) inside a position:relative wrapper, framed as its stories do (24px padding, surface fill, 14px rows and cards, a 24px end gutter). It is an overlay bar with no track fill, no buttons or arrows and no focus target (the thumb is not focusable and a press does not move focus, by design): a 12px track over the end edge, 4px inset at both ends, and a 6px fully rounded thumb of 35% surface-interaction, 60% on thumb hover and while dragging, faded in by opacity (150ms). Thumb size and offset follow the directive's geometry (min 24px); scrolled positions are drawn by offsetting the content statically. States: vertical (Default story, at the top), vertical-scrolled, vertical-end, horizontal (Horizontal story), horizontal-scrolled, both-axes (BothAxesAndRtl: two bars, the tracks meet in the corner), rtl (thumb starts at the right), short-content (long thumb), long-content (thumb at the 24px minimum), thumb-hover, dragging, auto-hidden (AutoHide story at rest: the bar is drawn at opacity 0). The viewports carry data-et-skip=CLIPPED: they clip on purpose. Numbers (light / dark), from shot pixels: thumb at rest vs page 1.57 / 1.93, hover and dragging 2.30 / 3.31; the track has no fill, so thumb vs track equals thumb vs page; over content (a 6% row tint) 1.53 / 1.90. WCAG 1.4.11 asks 3:1 for a needed graphical part: the rest thumb misses it in both schemes, hover passes only in dark. No decided rule arises: no focus ring (Q88), no accent mark or mint fill (Q99a, so no Q102), no filled button (Q101), no edge against the page (Q98). So only a is drawn. Open for Tom, not a decided rule: whether the rest thumb should reach 3:1.",
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
  render: (props: Props) =>
    drawing({
      body: `<div class="scrollbar-frame"${props.layout === 'rtl' ? ' dir="rtl"' : ''}><div class="scrollbar-wrapper">${render(props)}</div></div>`,
      styles: [scrollbarStyles, frame].join('\n'),
    }),
});
