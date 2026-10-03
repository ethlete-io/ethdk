import { paginate } from './pagination.util';

describe('paginate', () => {
  it('builds the page urls from the given current url', () => {
    const pages = paginate({ currentPage: 2, totalPageCount: 3, currentUrl: 'https://example.com/list?page=2&q=a' });

    expect(pages?.filter((page) => page.type === 'page').map((page) => page.url)).toEqual([
      'https://example.com/list?q=a',
      'https://example.com/list?page=2&q=a',
      'https://example.com/list?page=3&q=a',
    ]);
  });
});

describe('paginate edge cases', () => {
  const url = 'https://example.com/list';
  const pageNumbers = (pages: ReturnType<typeof paginate>) =>
    pages?.filter((page) => page.type === 'page').map((page) => page.page);
  const item = (pages: ReturnType<typeof paginate>, type: string) => pages?.find((page) => page.explicitType === type);

  it('returns null for missing options and zero pages', () => {
    expect(paginate(null)).toBeNull();
    expect(paginate(undefined)).toBeNull();
    expect(paginate({ currentPage: 1, totalPageCount: 0, currentUrl: url })).toBeNull();
  });

  it('renders a single page with every hot link disabled', () => {
    const pages = paginate({ currentPage: 1, totalPageCount: 1, currentUrl: url });

    expect(pageNumbers(pages)).toEqual([1]);
    expect(pages?.filter((page) => page.type === 'hotLink').every((page) => page.disabled)).toBe(true);
  });

  it('clamps a current page outside the range', () => {
    expect(item(paginate({ currentPage: 99, totalPageCount: 5, currentUrl: url }), 'current')?.page).toBe(5);
    expect(item(paginate({ currentPage: -3, totalPageCount: 5, currentUrl: url }), 'current')?.page).toBe(1);
  });

  it('keeps the window size at the edges', () => {
    expect(pageNumbers(paginate({ currentPage: 1, totalPageCount: 10, currentUrl: url }))).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(paginate({ currentPage: 10, totalPageCount: 10, currentUrl: url }))).toEqual([6, 7, 8, 9, 10]);
  });

  it('falls back to the first page for a NaN current page', () => {
    const pages = paginate({ currentPage: NaN, totalPageCount: 5, currentUrl: url });

    expect(item(pages, 'current')?.page).toBe(1);
    expect(pageNumbers(pages)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rounds a fractional current page down', () => {
    const pages = paginate({ currentPage: 2.5, totalPageCount: 5, currentUrl: url });

    expect(item(pages, 'current')?.page).toBe(2);
    expect(pageNumbers(pages)).toEqual([1, 2, 3, 4, 5]);
  });

  it('disables previous on a zero-based first page', () => {
    const pages = paginate({ currentPage: 0, totalPageCount: 5, firstPage: 0, currentUrl: url });

    expect(item(pages, 'previous')?.disabled).toBe(true);
    expect(item(pages, 'first')?.disabled).toBe(true);
    expect(pageNumbers(pages)).toEqual([0, 1, 2, 3, 4]);
  });

  it('omits first/last and previous/next on request', () => {
    const pages = paginate({
      currentPage: 2,
      totalPageCount: 3,
      omitFirstLast: true,
      omitPreviousNext: true,
      currentUrl: url,
    });

    expect(pages?.every((page) => page.type === 'page')).toBe(true);
  });
});
