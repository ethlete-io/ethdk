export const BREADCRUMB_EXAMPLES = {
  'breadcrumb/breadcrumb-default': () =>
    import('./breadcrumb-default.example').then((m) => m.BreadcrumbDefaultExampleComponent),
  'breadcrumb/breadcrumb-collapsed': () =>
    import('./breadcrumb-collapsed.example').then((m) => m.BreadcrumbCollapsedExampleComponent),
  'breadcrumb/breadcrumb-routed-outlet': () =>
    import('./breadcrumb-routed-outlet.example').then((m) => m.BreadcrumbRoutedOutletExampleComponent),
  'breadcrumb/breadcrumb-structured-data': () =>
    import('./breadcrumb-structured-data.example').then((m) => m.BreadcrumbStructuredDataExampleComponent),
};
