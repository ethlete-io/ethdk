export const STANDINGS_PICK_EXAMPLES = {
  'standings-pick/standings-pick-default': () =>
    import('./standings-pick-default.example').then((m) => m.StandingsPickDefaultExampleComponent),
  'standings-pick/standings-pick-locked': () =>
    import('./standings-pick-locked.example').then((m) => m.StandingsPickLockedExampleComponent),
};
