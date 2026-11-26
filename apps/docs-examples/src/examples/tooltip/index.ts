export const TOOLTIP_EXAMPLES = {
  'tooltip/tooltip-default': () => import('./tooltip-default.example').then((m) => m.TooltipDefaultExampleComponent),
  'tooltip/tooltip-in-dialog': () =>
    import('./tooltip-in-dialog.example').then((m) => m.TooltipInDialogExampleComponent),
};
