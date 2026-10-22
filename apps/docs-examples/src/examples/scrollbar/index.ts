export const SCROLLBAR_EXAMPLES = {
  'scrollbar/scrollbar-default': () =>
    import('./scrollbar-default.example').then((m) => m.ScrollbarDefaultExampleComponent),
  'scrollbar/scrollbar-both-axes-and-rtl': () =>
    import('./scrollbar-both-axes-and-rtl.example').then((m) => m.ScrollbarBothAxesAndRtlExampleComponent),
  'scrollbar/scrollbar-auto-hide': () =>
    import('./scrollbar-auto-hide.example').then((m) => m.ScrollbarAutoHideExampleComponent),
};
