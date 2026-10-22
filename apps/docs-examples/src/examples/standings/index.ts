export const STANDINGS_EXAMPLES = {
  'standings/standings-default': () =>
    import('./standings-default.example').then((m) => m.StandingsDefaultExampleComponent),
  'standings/standings-compact': () =>
    import('./standings-compact.example').then((m) => m.StandingsCompactExampleComponent),
};
