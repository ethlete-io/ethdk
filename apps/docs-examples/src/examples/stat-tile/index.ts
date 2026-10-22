export const STAT_TILE_EXAMPLES = {
  'stat-tile/stat-tile-default': () =>
    import('./stat-tile-default.example').then((m) => m.StatTileDefaultExampleComponent),
  'stat-tile/stat-tile-kpi-row': () =>
    import('./stat-tile-kpi-row.example').then((m) => m.StatTileKpiRowExampleComponent),
  'stat-tile/stat-tile-loading': () =>
    import('./stat-tile-loading.example').then((m) => m.StatTileLoadingExampleComponent),
};
