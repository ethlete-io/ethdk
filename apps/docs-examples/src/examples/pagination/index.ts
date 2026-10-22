export const PAGINATION_EXAMPLES = {
  'pagination/pagination-default': () =>
    import('./pagination-default.example').then((m) => m.PaginationDefaultExampleComponent),
  'pagination/pagination-many-pages': () =>
    import('./pagination-many-pages.example').then((m) => m.PaginationManyPagesExampleComponent),
  'pagination/pagination-range-and-jump': () =>
    import('./pagination-range-and-jump.example').then((m) => m.PaginationRangeAndJumpExampleComponent),
  'pagination/pagination-page-size-select': () =>
    import('./pagination-page-size-select.example').then((m) => m.PaginationPageSizeSelectExampleComponent),
  'pagination/pagination-localized': () =>
    import('./pagination-localized.example').then((m) => m.PaginationLocalizedExampleComponent),
  'pagination/pagination-links': () =>
    import('./pagination-links.example').then((m) => m.PaginationLinksExampleComponent),
};
