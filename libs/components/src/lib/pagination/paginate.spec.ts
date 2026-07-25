import { paginate } from './paginate';
import { PaginationItem } from './pagination.types';

// The page-number / ellipsis portion, as a readable sequence (page number, or '…' for a gap).
const window = (items: PaginationItem[]) =>
  items.filter((i) => i.type === 'page' || i.type === 'ellipsis').map((i) => (i.type === 'ellipsis' ? '…' : i.page));

const control = (items: PaginationItem[], type: PaginationItem['type']) => items.find((i) => i.type === type);

describe('paginate', () => {
  it('returns no items when there are no pages', () => {
    expect(paginate({ currentPage: 1, totalPages: 0 })).toEqual([]);
  });

  it('lists every page without ellipsis for small counts', () => {
    expect(window(paginate({ currentPage: 1, totalPages: 5 }))).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses far pages behind ellipses around the current page', () => {
    const items = paginate({ currentPage: 10, totalPages: 20, siblingCount: 1, boundaryCount: 1 });

    expect(window(items)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('shows only a trailing ellipsis near the start', () => {
    expect(window(paginate({ currentPage: 2, totalPages: 20 }))).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });

  it('marks the current page and clamps an out-of-range current page', () => {
    const items = paginate({ currentPage: 999, totalPages: 5 });
    const current = items.find((i) => i.current);

    expect(current?.page).toBe(5);
    expect(control(items, 'last')?.disabled).toBe(true);
    expect(control(items, 'next')?.disabled).toBe(true);
  });

  it('disables first/previous on the first page', () => {
    const items = paginate({ currentPage: 1, totalPages: 5 });

    expect(control(items, 'first')?.disabled).toBe(true);
    expect(control(items, 'previous')?.disabled).toBe(true);
    expect(control(items, 'next')?.disabled).toBe(false);
  });

  it('points previous/next at the adjacent pages', () => {
    const items = paginate({ currentPage: 3, totalPages: 10 });

    expect(control(items, 'previous')?.page).toBe(2);
    expect(control(items, 'next')?.page).toBe(4);
  });

  it('omits the first/last and previous/next controls when asked', () => {
    const items = paginate({ currentPage: 3, totalPages: 10, hideFirstLast: true, hidePreviousNext: true });

    expect(items.every((i) => i.type === 'page' || i.type === 'ellipsis')).toBe(true);
  });

  it('labels items in English by default', () => {
    const items = paginate({ currentPage: 3, totalPages: 10 });

    expect(control(items, 'previous')?.label).toBe('Previous page');
    expect(items.find((i) => i.page === 3)?.label).toBe('Page 3');
  });

  it('takes label overrides, falling back to the defaults per key', () => {
    const items = paginate({
      currentPage: 3,
      totalPages: 10,
      labels: { previous: 'Vorherige Seite', page: (page, totalPages) => `Seite ${page} von ${totalPages}` },
    });

    expect(control(items, 'previous')?.label).toBe('Vorherige Seite');
    expect(items.find((i) => i.page === 3)?.label).toBe('Seite 3 von 10');
    expect(control(items, 'next')?.label).toBe('Next page'); // not overridden
  });
});
