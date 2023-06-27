import { clamp } from '@ethlete/core';
import { PaginateOptions, PaginationItem } from '../types';

export const paginate = (value?: PaginateOptions | null) => {
  if (!value) {
    return null;
  }

  const { omitFirstLast = false, omitPreviousNext = false, pagesBeforeAfter = 2 } = value;

  const pages: PaginationItem[] = [];
  const activePage = clamp(value.currentPage, 1, value.totalPageCount);

  if (value.totalPageCount === 0) {
    return null;
  }

  const currentUrl = new URL(window.location.href);

  const createUrl = (page: number) => {
    const url = new URL(currentUrl.href);

    if (page === 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page.toString());
    }

    return url.toString();
  };

  if (!omitFirstLast) {
    pages.push({
      page: 1,
      current: false,
      ariaLabel: 'First page',
      disabled: activePage === 1,
      type: 'hotLink',
      explicitType: 'first',
      url: createUrl(1),
    });
  }

  if (!omitPreviousNext) {
    pages.push({
      page: activePage - 1,
      current: false,
      ariaLabel: `Previous page`,
      disabled: activePage === 1,
      type: 'hotLink',
      explicitType: 'previous',
      url: createUrl(activePage - 1),
    });
  }

  // add N pages before and after active page
  for (let i = activePage - pagesBeforeAfter; i <= activePage + pagesBeforeAfter; i++) {
    if (i > 0 && i <= value.totalPageCount) {
      const explicitType =
        i === activePage
          ? 'current'
          : i === activePage - 1 || i === activePage + 1
          ? 'page-number-close'
          : 'page-number-far';

      pages.push({
        page: i,
        current: i === activePage,
        ariaLabel: `Page ${i}`,
        disabled: false,
        type: 'page',
        explicitType,
        url: createUrl(i),
      });
    }
  }

  if (!omitPreviousNext) {
    pages.push({
      page: activePage + 1,
      current: false,
      ariaLabel: `Next page`,
      disabled: activePage === value.totalPageCount,
      type: 'hotLink',
      explicitType: 'next',
      url: createUrl(activePage + 1),
    });
  }

  if (!omitFirstLast) {
    pages.push({
      page: value.totalPageCount,
      current: false,
      ariaLabel: `Last page`,
      disabled: activePage === value.totalPageCount,
      type: 'hotLink',
      explicitType: 'last',
      url: createUrl(value.totalPageCount),
    });
  }

  return pages;
};
