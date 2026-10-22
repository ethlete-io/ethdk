export const QUERY_ERROR_EXAMPLES = {
  'query-error/query-error-default': () =>
    import('./query-error-default.example').then((m) => m.QueryErrorDefaultExampleComponent),
  'query-error/query-error-violation-list': () =>
    import('./query-error-violation-list.example').then((m) => m.QueryErrorViolationListExampleComponent),
  'query-error/query-error-retryable': () =>
    import('./query-error-retryable.example').then((m) => m.QueryErrorRetryableExampleComponent),
};
