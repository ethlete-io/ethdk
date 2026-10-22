export const CDK_OVERLAYS_EXAMPLES = {
  'cdk-overlays/cdk-overlay-handler': () =>
    import('./cdk-overlay-handler.example').then((m) => m.CdkOverlayHandlerExampleComponent),
  'cdk-overlays/cdk-overlay-query-param': () =>
    import('./cdk-overlay-query-param.example').then((m) => m.CdkOverlayQueryParamExampleComponent),
  'cdk-overlays/cdk-overlay-responsive': () =>
    import('./cdk-overlay-responsive.example').then((m) => m.CdkOverlayResponsiveExampleComponent),
  'cdk-overlays/cdk-overlay-routing': () =>
    import('./cdk-overlay-routing.example').then((m) => m.CdkOverlayRoutingExampleComponent),
};
