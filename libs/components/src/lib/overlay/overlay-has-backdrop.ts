import { InjectionToken } from '@angular/core';
import { OverlayConfig } from './overlay-config';
import { OverlayBreakpointConfig } from './strategies/overlay-strategy.types';

/**
 * Whether an overlay renders a backdrop: `hasBackdrop` on the overlay config wins, then the active
 * strategy's own default, then the mode (a modal overlay has one).
 */
export const resolveOverlayHasBackdrop = (config: OverlayConfig, strategyConfig?: OverlayBreakpointConfig) =>
  config.hasBackdrop ?? strategyConfig?.hasBackdrop ?? config.mode !== 'non-modal';

/** @internal The resolved backdrop state the overlay mounted with, for the container's elevation. */
export const OVERLAY_HAS_BACKDROP = new InjectionToken<boolean>('OverlayHasBackdrop');
