export const TIMELINE_EXAMPLES = {
  'timeline/timeline-default': () =>
    import('./timeline-default.example').then((m) => m.TimelineDefaultExampleComponent),
  'timeline/timeline-with-markers': () =>
    import('./timeline-with-markers.example').then((m) => m.TimelineWithMarkersExampleComponent),
  'timeline/timeline-compact': () =>
    import('./timeline-compact.example').then((m) => m.TimelineCompactExampleComponent),
};
