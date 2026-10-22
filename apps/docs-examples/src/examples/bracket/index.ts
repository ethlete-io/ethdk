export const BRACKET_EXAMPLES = {
  'bracket/bracket-single-elimination': () =>
    import('./bracket-single-elimination.example').then((m) => m.BracketSingleEliminationExampleComponent),
  'bracket/bracket-double-elimination': () =>
    import('./bracket-double-elimination.example').then((m) => m.BracketDoubleEliminationExampleComponent),
  'bracket/bracket-mirrored-single-elimination': () =>
    import('./bracket-mirrored-single-elimination.example').then(
      (m) => m.BracketMirroredSingleEliminationExampleComponent,
    ),
  'bracket/bracket-skeleton-double-elimination': () =>
    import('./bracket-skeleton-double-elimination.example').then(
      (m) => m.BracketSkeletonDoubleEliminationExampleComponent,
    ),
  'bracket/bracket-participant-focus': () =>
    import('./bracket-participant-focus.example').then((m) => m.BracketParticipantFocusExampleComponent),
};
