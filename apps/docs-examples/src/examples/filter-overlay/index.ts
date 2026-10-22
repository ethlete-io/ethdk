export const FILTER_OVERLAY_EXAMPLES = {
  'filter-overlay/filter-overlay-default': () =>
    import('./filter-overlay-default.example').then((m) => m.FilterOverlayDefaultExampleComponent),
  'filter-overlay/filter-overlay-without-preview': () =>
    import('./filter-overlay-without-preview.example').then((m) => m.FilterOverlayWithoutPreviewExampleComponent),
};
