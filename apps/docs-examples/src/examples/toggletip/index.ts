export const TOGGLETIP_EXAMPLES = {
  'toggletip/toggletip-default': () =>
    import('./toggletip-default.example').then((m) => m.ToggletipDefaultExampleComponent),
  'toggletip/toggletip-icon': () => import('./toggletip-icon.example').then((m) => m.ToggletipIconExampleComponent),
};
