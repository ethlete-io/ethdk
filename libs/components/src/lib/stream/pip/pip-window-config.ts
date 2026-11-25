import { DEFAULT_OVERLAY_LAYER, defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

/** The default PiP window layer: above app overlays (`2147483003`) and the notification stack. */
export const PIP_WINDOW_OVERLAY_LAYER = /* @__PURE__ */ (() => DEFAULT_OVERLAY_LAYER + 2)();

export type PipWindowConfig = {
  /**
   * The stacking level of the PiP window. It sets both the window's `z-index` and its
   * `data-et-overlay-layer`, so a press on the window never closes an overlay below that level.
   *
   * @default PIP_WINDOW_OVERLAY_LAYER (2147483005)
   */
  overlayLayer: number;
};

const DEFAULT_PIP_WINDOW_CONFIG: PipWindowConfig = {
  overlayLayer: PIP_WINDOW_OVERLAY_LAYER,
};

const PIP_WINDOW_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<PipWindowConfig>(DEFAULT_PIP_WINDOW_CONFIG, {
  name: 'PipWindowConfig',
});

/** Sets the PiP window layer, e.g. `providePipWindowConfig({ overlayLayer: 2147483010 })` in the app config. */
export const providePipWindowConfig = /* @__PURE__ */ toProvideFn(PIP_WINDOW_CONFIG_DEF);
export const injectPipWindowConfig = /* @__PURE__ */ toInjectFn(PIP_WINDOW_CONFIG_DEF);
