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
