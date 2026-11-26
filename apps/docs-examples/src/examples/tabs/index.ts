export const TABS_EXAMPLES = {
  'tabs/tabs-default': () => import('./tabs-default.example').then((m) => m.TabsDefaultExampleComponent),
  'tabs/nav-tabs-default': () =>
    import('./nav-tabs-default.example').then((m) => ({
      component: m.NavTabsDefaultExampleComponent,
      routes: m.routes,
    })),
};
