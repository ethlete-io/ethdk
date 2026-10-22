export const LOADER_EXAMPLES = {
  'loader/loader-brand-loader': () =>
    import('./loader-brand-loader.example').then((m) => m.LoaderBrandLoaderExampleComponent),
  'loader/loader-progress-bar': () =>
    import('./loader-progress-bar.example').then((m) => m.LoaderProgressBarExampleComponent),
  'loader/loader-spinner-determinate': () =>
    import('./loader-spinner-determinate.example').then((m) => m.LoaderSpinnerDeterminateExampleComponent),
  'loader/loader-spinner-themed': () =>
    import('./loader-spinner-themed.example').then((m) => m.LoaderSpinnerThemedExampleComponent),
};
