export const CHART_EXAMPLES = {
  'chart/chart-default': () => import('./chart-default.example').then((m) => m.ChartDefaultExampleComponent),
  'chart/chart-dense-labels': () =>
    import('./chart-dense-labels.example').then((m) => m.ChartDenseLabelsExampleComponent),
  'chart/chart-grouped': () => import('./chart-grouped.example').then((m) => m.ChartGroupedExampleComponent),
  'chart/chart-stacked-negative': () =>
    import('./chart-stacked-negative.example').then((m) => m.ChartStackedNegativeExampleComponent),
  'chart/chart-horizontal': () => import('./chart-horizontal.example').then((m) => m.ChartHorizontalExampleComponent),
  'chart/chart-empty': () => import('./chart-empty.example').then((m) => m.ChartEmptyExampleComponent),
};
