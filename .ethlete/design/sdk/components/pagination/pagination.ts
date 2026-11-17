import {
  pagination,
  type PaginationMockItem,
  type PaginationMockOptions,
  paginationStyles,
} from '@ethlete/components/design/pagination';
import { definePart, drawing, interactionRows } from '@design-system';
import edge from './pagination.css?inline';

type ItemInteraction = 'hover' | 'active' | 'focus-visible';

type Props = Omit<PaginationMockOptions, 'items'> & {
  page: number;
  pages: (number | null)[];
  total: number;
  target?: number;
  forced?: ItemInteraction;
};

const MARK = 'data-et-control="item" data-can-animate';

const items = ({ page, pages, total, target, forced }: Props): PaginationMockItem[] => {
  const attributes = (entry: number) => (forced && entry === target ? `${MARK} data-et-force="${forced}"` : MARK);

  return [
    { type: 'first', page: 1, disabled: page === 1, attributes: MARK },
    { type: 'previous', page: page - 1, disabled: page === 1, attributes: MARK },
    ...pages.map((entry): PaginationMockItem =>
      entry === null
        ? { type: 'ellipsis' }
        : { type: 'page', page: entry, current: entry === page, attributes: attributes(entry) },
    ),
    { type: 'next', page: page + 1, disabled: page === total, attributes: MARK },
    { type: 'last', page: total, disabled: page === total, attributes: MARK },
  ];
};

const MIDDLE: Props = { page: 10, total: 20, pages: [1, null, 9, 10, 11, null, 20] };

const { states, grid } = interactionRows(
  {
    page: { ...MIDDLE, target: 11 },
    current: { ...MIDDLE, target: 10 },
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props: Props, interaction: ItemInteraction): Props => ({ ...props, forced: interaction }),
  },
);

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    first: { page: 1, total: 20, pages: [1, 2, 3, 4, 5, null, 20] },
    middle: MIDDLE,
    last: { page: 20, total: 20, pages: [1, null, 16, 17, 18, 19, 20] },
    few: { page: 2, total: 5, pages: [1, 2, 3, 4, 5] },
    ...states,
    range: { ...MIDDLE, range: 'Showing 91–100 of 200' },
    sm: { ...MIDDLE, size: 'sm' },
    links: { ...MIDDLE, renderAs: 'links' },
    compact: { ...MIDDLE, compactStatus: '10 / 20' },
  },
  describe: {
    first: 'Page 1 of 20; check that first and previous are disabled and the ellipsis sits before 20.',
    middle:
      'Page 10 of 20 with ellipses on both sides; check that page 10 reads as current and all arrows are enabled.',
    last: 'Page 20 of 20; check that next and last are disabled and the ellipsis sits after 1.',
    few: 'Page 2 of 5 with every page shown; check that no ellipsis appears.',
    page: 'Page 10 of 20 at rest; check that page 11 looks like any other plain page.',
    'page-hover': 'Page 11 hovered; check that only page 11 takes the hover tint.',
    'page-active': 'Page 11 pressed; check that the pressed tint is deeper than hover.',
    'page-focus-visible':
      'Page 11 focused by keyboard; check that the focus ring wraps page 11 without shifting neighbours.',
    current: 'Page 10 of 20 at rest; check that the current page 10 stands out from the plain pages.',
    'current-hover': 'The current page hovered; check that it keeps its current look under hover.',
    'current-active': 'The current page pressed; check that it keeps its current look while pressed.',
    'current-focus-visible':
      'The current page focused by keyboard; check that the focus ring shows around the current fill.',
    range: 'Page 10 with the Showing 91–100 of 200 range; check that the range text sits beside the controls.',
    sm: 'Page 10 at size sm; check that buttons and text shrink together.',
    links: 'Page 10 rendered as links; check that it looks the same as the button version.',
    compact: 'Page 10 with the compact 10 / 20 status; check that the status replaces the page list.',
  },
  grid,
  widths: [480],
  controls: {
    item: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  frame: (body) => `<div class="pagination-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: pagination({ ...props, items: items(props) }),
      styles: [paginationStyles, edge].join('\n'),
    }),
});
