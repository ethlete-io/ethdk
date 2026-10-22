export const CDK_BREADCRUMB_EXAMPLES = {
  'cdk-breadcrumb/cdk-breadcrumb-default': () =>
    import('./cdk-breadcrumb-default.example').then((m) => ({
      component: m.CdkBreadcrumbDefaultExampleComponent,
      routes: m.routes,
    })),
};
