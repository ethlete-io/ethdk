export const SPORT_RECIPES_EXAMPLES = {
  'sport-recipes/sport-recipes-match-rail': () =>
    import('./sport-recipes-match-rail.example').then((m) => m.SportRecipesMatchRailExampleComponent),
  'sport-recipes/sport-recipes-entity-cards': () =>
    import('./sport-recipes-entity-cards.example').then((m) => m.SportRecipesEntityCardsExampleComponent),
};
