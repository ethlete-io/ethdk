export const LINE_CHART_EXAMPLES = {
  'line-chart/line-chart-multi-series': () =>
    import('./line-chart-multi-series.example').then((m) => m.LineChartMultiSeriesExampleComponent),
  'line-chart/line-chart-time-axis': () =>
    import('./line-chart-time-axis.example').then((m) => m.LineChartTimeAxisExampleComponent),
  'line-chart/line-chart-gaps': () => import('./line-chart-gaps.example').then((m) => m.LineChartGapsExampleComponent),
  'line-chart/line-chart-stacked-area': () =>
    import('./line-chart-stacked-area.example').then((m) => m.LineChartStackedAreaExampleComponent),
  'line-chart/line-chart-dense-daily': () =>
    import('./line-chart-dense-daily.example').then((m) => m.LineChartDenseDailyExampleComponent),
};
