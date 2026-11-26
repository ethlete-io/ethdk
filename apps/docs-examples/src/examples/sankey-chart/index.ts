export const SANKEY_CHART_EXAMPLES = {
  'sankey-chart/sankey-chart-default': () =>
    import('./sankey-chart-default.example').then((m) => m.SankeyChartDefaultExampleComponent),
  'sankey-chart/sankey-chart-multi-level': () =>
    import('./sankey-chart-multi-level.example').then((m) => m.SankeyChartMultiLevelExampleComponent),
  'sankey-chart/sankey-chart-narrow-screen': () =>
    import('./sankey-chart-narrow-screen.example').then((m) => m.SankeyChartNarrowScreenExampleComponent),
  'sankey-chart/sankey-chart-many-nodes': () =>
    import('./sankey-chart-many-nodes.example').then((m) => m.SankeyChartManyNodesExampleComponent),
};
