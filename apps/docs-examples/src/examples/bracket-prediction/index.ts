export const BRACKET_PREDICTION_EXAMPLES = {
  'bracket-prediction/bracket-prediction-interactive': () =>
    import('./bracket-prediction-interactive.example').then((m) => m.BracketPredictionInteractiveExampleComponent),
  'bracket-prediction/bracket-prediction-pick-card-states': () =>
    import('./bracket-prediction-pick-card-states.example').then(
      (m) => m.BracketPredictionPickCardStatesExampleComponent,
    ),
  'bracket-prediction/bracket-prediction-slot-sources': () =>
    import('./bracket-prediction-slot-sources.example').then((m) => m.BracketPredictionSlotSourcesExampleComponent),
};
