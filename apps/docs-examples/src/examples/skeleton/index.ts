export const SKELETON_EXAMPLES = {
  'skeleton/skeleton-default': () =>
    import('./skeleton-default.example').then((m) => m.SkeletonDefaultExampleComponent),
  'skeleton/skeleton-static': () => import('./skeleton-static.example').then((m) => m.SkeletonStaticExampleComponent),
};
