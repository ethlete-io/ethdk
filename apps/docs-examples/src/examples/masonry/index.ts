export const MASONRY_EXAMPLES = {
  'masonry/masonry-default': () => import('./masonry-default.example').then((m) => m.MasonryDefaultExampleComponent),
  'masonry/masonry-appending-items': () =>
    import('./masonry-appending-items.example').then((m) => m.MasonryAppendingItemsExampleComponent),
};
