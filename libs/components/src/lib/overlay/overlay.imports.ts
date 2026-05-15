import { OverlayAnchorDirective } from './headless/overlay-anchor.directive';
import { OverlaySurfaceDirective } from './headless/overlay-surface.directive';
import { OverlayTriggerDirective } from './headless/overlay-trigger.directive';
import { OverlayDirective } from './headless/overlay.directive';

export const OVERLAY_IMPORTS = [
  OverlayDirective,
  OverlayTriggerDirective,
  OverlayAnchorDirective,
  OverlaySurfaceDirective,
] as const;
