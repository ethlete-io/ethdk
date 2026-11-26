export const SCROLLABLE_EXAMPLES = {
  'scrollable/scrollable-default': () =>
    import('./scrollable-default.example').then((m) => m.ScrollableDefaultExampleComponent),
  'scrollable/scrollable-snap': () => import('./scrollable-snap.example').then((m) => m.ScrollableSnapExampleComponent),
};
