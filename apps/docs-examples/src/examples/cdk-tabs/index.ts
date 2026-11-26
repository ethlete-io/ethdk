export const CDK_TABS_EXAMPLES = {
  'cdk-tabs/cdk-inline-tabs-default': () =>
    import('./cdk-inline-tabs-default.example').then((m) => m.CdkInlineTabsDefaultExampleComponent),
  'cdk-tabs/cdk-inline-tabs-custom-label': () =>
    import('./cdk-inline-tabs-custom-label.example').then((m) => m.CdkInlineTabsCustomLabelExampleComponent),
  'cdk-tabs/cdk-nav-tabs-default': () =>
    import('./cdk-nav-tabs-default.example').then((m) => ({
      component: m.CdkNavTabsDefaultExampleComponent,
      routes: m.routes,
    })),
};
