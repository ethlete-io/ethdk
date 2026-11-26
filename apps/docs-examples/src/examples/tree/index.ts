export const TREE_EXAMPLES = {
  'tree/tree-default': () => import('./tree-default.example').then((m) => m.TreeDefaultExampleComponent),
  'tree/tree-multi-select': () => import('./tree-multi-select.example').then((m) => m.TreeMultiSelectExampleComponent),
  'tree/tree-lazy-loading': () => import('./tree-lazy-loading.example').then((m) => m.TreeLazyLoadingExampleComponent),
  'tree/tree-custom-rows': () => import('./tree-custom-rows.example').then((m) => m.TreeCustomRowsExampleComponent),
};
