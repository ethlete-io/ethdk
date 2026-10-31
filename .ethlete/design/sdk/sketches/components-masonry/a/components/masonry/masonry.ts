import { masonry, MasonryMockItem, masonryStyles } from '@ethlete/components/design/masonry';
import { definePart, drawing } from '@design-system';
import frame from './masonry.css?inline';

type Props = {
  items: 'rest' | 'uneven' | 'few';
  width?: number;
  columnWidth?: number;
  dir?: 'rtl';
};

const tiles = (heights: readonly number[]): MasonryMockItem[] =>
  heights.map((height, index) => ({ title: `Card ${index + 1}`, subtitle: `Height ${height}`, height }));

const ITEMS = {
  rest: tiles([120, 160, 140, 180, 120, 150, 140, 110]),
  uneven: tiles([80, 260, 120, 60, 200, 90, 170, 70, 130]),
  few: tiles([120, 160, 100]),
};

export default definePart({
  note: "The SDK masonry (etMasonry, etMasonryItem), first drawing, drawn by its mock from @ethlete/components/design/masonry with the real masonry-styles CSS. Items are packed by a copy of the lib's maths (column count from the container width and the columnWidth minimum, greedy shortest-column placement), settled and positioned (data-settled, data-positioned). Framed as a 480px page with 16px padding; 448px content, gap 16 (the default). The lib draws nothing visual: its CSS is absolute positioning, the RTL flip, the fade-in on first placement and the move transition, so the tiles (title, muted height line, 8px radius, next surface elevation) are demo content drawn by the mock, not lib design. States: rest (columnWidth 130, a consumer value: 3 columns of 138.67px, eight tiles 110-180 high), uneven (same columns, nine tiles 60-260 high: the ragged bottom edge), narrow (the same tiles in a 280px container: 2 columns of 132px, the count comes from the container, not a media query), single-column (the default columnWidth 250 at 448px: 1 column of 448px), rtl (rest with dir=rtl: column 0 on the right). Static snapshot: the appear fade and the move transition drawn at rest. No focus, hover, loading or empty state exists in the lib (an empty masonry is 0px high), so none is drawn. Numbers (light / dark), from shot pixels at scale 2, demo tiles only: tile fill vs page 1.14 / 1.18; tile title vs fill 15.73 / 14.50, muted line 6.86 / 5.86. Q98 numbers only: no edge, the fill alone sets the tile off the page. No decided rule arises: no focus ring (Q88), no mint mark or fill (Q99a, Q102), no button (Q101). Variant a only. Later rounds, left out here: the appear fade and move timing tokens (--et-masonry-appear-duration, -move-duration, -move-easing), the infinite-scroll append, per-breakpoint columnWidth and gap maps.",
  madeBy: ['claude-opus-5-5'],
  states: {
    rest: { items: 'rest', columnWidth: 130 },
    uneven: { items: 'uneven', columnWidth: 130 },
    narrow: { items: 'rest', columnWidth: 130, width: 280 },
    'single-column': { items: 'few' },
    rtl: { items: 'rest', columnWidth: 130, dir: 'rtl' },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${masonry({
        items: ITEMS[props.items],
        width: props.width,
        columnWidth: props.columnWidth,
        dir: props.dir,
      })}</div>`,
      styles: [masonryStyles, frame].join('\n'),
    }),
});
