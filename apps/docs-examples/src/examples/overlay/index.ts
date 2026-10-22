export const OVERLAY_EXAMPLES = {
  'overlay/overlay-strategies': () =>
    import('./overlay-strategies.example').then((m) => m.OverlayStrategiesExampleComponent),
  'overlay/overlay-alert-dialog': () =>
    import('./overlay-alert-dialog.example').then((m) => m.OverlayAlertDialogExampleComponent),
  'overlay/overlay-busy-state': () =>
    import('./overlay-busy-state.example').then((m) => m.OverlayBusyStateExampleComponent),
  'overlay/overlay-unsaved-changes': () =>
    import('./overlay-unsaved-changes.example').then((m) => m.OverlayUnsavedChangesExampleComponent),
  'overlay/overlay-routing': () => import('./overlay-routing.example').then((m) => m.OverlayRoutingExampleComponent),
  'overlay/overlay-openers': () => import('./overlay-openers.example').then((m) => m.OverlayOpenersExampleComponent),
};
