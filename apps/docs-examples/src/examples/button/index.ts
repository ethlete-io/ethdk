export const BUTTON_EXAMPLES = {
  'button/button-query': () => import('./button-query.example').then((m) => m.ButtonQueryExampleComponent),
  'button/button-split': () => import('./button-split.example').then((m) => m.ButtonSplitExampleComponent),
  'button/button-stretch': () => import('./button-stretch.example').then((m) => m.ButtonStretchExampleComponent),
  'button/button-surface': () => import('./button-surface.example').then((m) => m.ButtonSurfaceExampleComponent),
};
