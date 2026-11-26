export const CASCADER_EXAMPLES = {
  'cascader/cascader-default': () =>
    import('./cascader-default.example').then((m) => m.CascaderDefaultExampleComponent),
  'cascader/cascader-search': () => import('./cascader-search.example').then((m) => m.CascaderSearchExampleComponent),
  'cascader/cascader-multiple': () =>
    import('./cascader-multiple.example').then((m) => m.CascaderMultipleExampleComponent),
  'cascader/cascader-multiple-with-search': () =>
    import('./cascader-multiple-with-search.example').then((m) => m.CascaderMultipleWithSearchExampleComponent),
  'cascader/cascader-any-level': () =>
    import('./cascader-any-level.example').then((m) => m.CascaderAnyLevelExampleComponent),
  'cascader/cascader-async-levels': () =>
    import('./cascader-async-levels.example').then((m) => m.CascaderAsyncLevelsExampleComponent),
  'cascader/cascader-deep-nesting': () =>
    import('./cascader-deep-nesting.example').then((m) => m.CascaderDeepNestingExampleComponent),
};
