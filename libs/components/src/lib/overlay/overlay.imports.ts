import { provideEnvironmentInitializer } from '@angular/core';
import { OverlayAnchorDirective } from './headless/overlay-anchor.directive';
import { OverlaySurfaceDirective } from './headless/overlay-surface.directive';
import { OverlayTriggerDirective } from './headless/overlay-trigger.directive';
import { OverlayDirective } from './headless/overlay.directive';
import { OverlayBodyComponent } from './overlay-body.component';
import { OverlayCloseDirective } from './overlay-close.directive';
import { OverlayFooterDirective } from './overlay-footer.directive';
import { OverlayHeaderDirective } from './overlay-header.directive';
import { OverlayMainDirective } from './overlay-main.directive';
import { injectOverlayScrollBlocker } from './overlay-scroll-blocker';
import { OverlayTitleDirective } from './overlay-title.directive';

export const OVERLAY_IMPORTS = [
  OverlayDirective,
  OverlayTriggerDirective,
  OverlayAnchorDirective,
  OverlaySurfaceDirective,
] as const;

export const OVERLAY_CONTENT_IMPORTS = [
  OverlayCloseDirective,
  OverlayTitleDirective,
  OverlayHeaderDirective,
  OverlayBodyComponent,
  OverlayFooterDirective,
  OverlayMainDirective,
] as const;

export const provideOverlay = () => {
  return [
    provideEnvironmentInitializer(() => {
      injectOverlayScrollBlocker();
    }),
  ];
};
