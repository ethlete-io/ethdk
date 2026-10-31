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
  note: "Today's look",
  madeBy: ['claude-opus-5-5'],
  states: {
    rest: { items: 'rest', columnWidth: 130 },
    uneven: { items: 'uneven', columnWidth: 130 },
    narrow: { items: 'rest', columnWidth: 130, width: 280 },
    'single-column': { items: 'few' },
    rtl: { items: 'rest', columnWidth: 130, dir: 'rtl' },
  },
  widths: [480],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: masonry({
        items: ITEMS[props.items],
        width: props.width,
        columnWidth: props.columnWidth,
        dir: props.dir,
      }),
      styles: [masonryStyles, frame].join('\n'),
    }),
});
