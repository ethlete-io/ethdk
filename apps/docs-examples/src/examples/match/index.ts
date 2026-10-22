export const MATCH_EXAMPLES = {
  'match/match-default': () => import('./match-default.example').then((m) => m.MatchDefaultExampleComponent),
  'match/match-outcome': () => import('./match-outcome.example').then((m) => m.MatchOutcomeExampleComponent),
  'match/match-states': () => import('./match-states.example').then((m) => m.MatchStatesExampleComponent),
  'match/match-live': () => import('./match-live.example').then((m) => m.MatchLiveExampleComponent),
};
