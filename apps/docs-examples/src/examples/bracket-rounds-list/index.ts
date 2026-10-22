export const BRACKET_ROUNDS_LIST_EXAMPLES = {
  'bracket-rounds-list/bracket-rounds-list-double-elimination': () =>
    import('./bracket-rounds-list-double-elimination.example').then(
      (m) => m.BracketRoundsListDoubleEliminationExampleComponent,
    ),
  'bracket-rounds-list/bracket-rounds-list-round-switcher': () =>
    import('./bracket-rounds-list-round-switcher.example').then(
      (m) => m.BracketRoundsListRoundSwitcherExampleComponent,
    ),
  'bracket-rounds-list/bracket-rounds-list-adaptive': () =>
    import('./bracket-rounds-list-adaptive.example').then((m) => m.BracketRoundsListAdaptiveExampleComponent),
};
