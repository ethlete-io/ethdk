export const STREAM_EXAMPLES = {
  'stream/stream-default': () => import('./stream-default.example').then((m) => m.StreamDefaultExampleComponent),
  'stream/stream-slot-controls': () =>
    import('./stream-slot-controls.example').then((m) => m.StreamSlotControlsExampleComponent),
  'stream/stream-consent-provider': () =>
    import('./stream-consent-provider.example').then((m) => m.StreamConsentProviderExampleComponent),
  'stream/stream-custom-pip-chrome': () =>
    import('./stream-custom-pip-chrome.example').then((m) => m.StreamCustomPipChromeExampleComponent),
  'stream/stream-mixed-aspect-ratios': () =>
    import('./stream-mixed-aspect-ratios.example').then((m) => m.StreamMixedAspectRatiosExampleComponent),
};
