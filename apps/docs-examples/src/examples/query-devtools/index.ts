export const QUERY_DEVTOOLS_EXAMPLES = {
  'query-devtools/devtools-default': () =>
    import('./devtools-default.example').then((m) => m.QueryDevtoolsExampleComponent),
};
