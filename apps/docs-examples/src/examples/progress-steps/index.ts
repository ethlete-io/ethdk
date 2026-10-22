export const PROGRESS_STEPS_EXAMPLES = {
  'progress-steps/progress-steps-default': () =>
    import('./progress-steps-default.example').then((m) => m.ProgressStepsDefaultExampleComponent),
  'progress-steps/progress-steps-outcomes': () =>
    import('./progress-steps-outcomes.example').then((m) => m.ProgressStepsOutcomesExampleComponent),
  'progress-steps/progress-steps-vertical': () =>
    import('./progress-steps-vertical.example').then((m) => m.ProgressStepsVerticalExampleComponent),
  'progress-steps/progress-steps-vertical-descriptions': () =>
    import('./progress-steps-vertical-descriptions.example').then(
      (m) => m.ProgressStepsVerticalDescriptionsExampleComponent,
    ),
};
