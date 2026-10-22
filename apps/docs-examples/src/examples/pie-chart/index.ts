export const PIE_CHART_EXAMPLES = {
  'pie-chart/pie-chart-default': () =>
    import('./pie-chart-default.example').then((m) => m.PieChartDefaultExampleComponent),
  'pie-chart/pie-chart-donut-total': () =>
    import('./pie-chart-donut-total.example').then((m) => m.PieChartDonutTotalExampleComponent),
  'pie-chart/pie-chart-many-slices': () =>
    import('./pie-chart-many-slices.example').then((m) => m.PieChartManySlicesExampleComponent),
};
