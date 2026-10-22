export const TOOLBAR_EXAMPLES = {
  'toolbar/toolbar-default': () => import('./toolbar-default.example').then((m) => m.ToolbarDefaultExampleComponent),
  'toolbar/toolbar-vertical': () => import('./toolbar-vertical.example').then((m) => m.ToolbarVerticalExampleComponent),
  'toolbar/toolbar-disabled-control': () =>
    import('./toolbar-disabled-control.example').then((m) => m.ToolbarDisabledControlExampleComponent),
};
