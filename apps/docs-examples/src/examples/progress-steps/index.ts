export const PROGRESS_STEPS_EXAMPLES = {
  'progress-steps/progress-steps-default': () =>
    import('./progress-steps-default.example').then((m) => m.ProgressStepsDefaultExampleComponent),
  'progress-steps/progress-steps-outcomes': () =>
    import('./progress-steps-outcomes.example').then((m) => m.ProgressStepsOutcomesExampleComponent),
  'progress-steps/progress-steps-skipped': () =>
    import('./progress-steps-skipped.example').then((m) => m.ProgressStepsSkippedExampleComponent),
  'progress-steps/progress-steps-auto': () =>
    import('./progress-steps-auto.example').then((m) => m.ProgressStepsAutoExampleComponent),
  'progress-steps/progress-steps-vertical': () =>
    import('./progress-steps-vertical.example').then((m) => m.ProgressStepsVerticalExampleComponent),
  'progress-steps/progress-steps-vertical-descriptions': () =>
    import('./progress-steps-vertical-descriptions.example').then(
      (m) => m.ProgressStepsVerticalDescriptionsExampleComponent,
    ),
};
