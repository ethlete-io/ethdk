export const BADGE_EXAMPLES = {
  'badge/badge-default': () => import('./badge-default.example').then((m) => m.BadgeDefaultExampleComponent),
  'badge/badge-corner': () => import('./badge-corner.example').then((m) => m.BadgeCornerExampleComponent),
};
