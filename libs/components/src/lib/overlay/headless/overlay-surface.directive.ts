import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { OverlayDirective } from './overlay.directive';

export type OverlaySurfaceContext = {
  $implicit: OverlayDirective;
  overlay: OverlayDirective;
  close: (result?: unknown) => void;
};

@Directive({
  selector: 'ng-template[etOverlaySurface]',
  exportAs: 'etOverlaySurface',
})
export class OverlaySurfaceDirective {
  private overlay = inject(OverlayDirective, { optional: true });
  /** @internal */
  private tpl = inject<TemplateRef<OverlaySurfaceContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.overlay?.registeredSurface.set(this);

    this.destroyRef.onDestroy(() => {
      this.overlay?.unregisterSurface(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.overlay) {
          throw new RuntimeError(
            OVERLAY_ERROR_CODES.SURFACE_OUTSIDE_OVERLAY,
            '[OverlaySurfaceDirective] etOverlaySurface must be placed inside an [etOverlay] element.',
          );
        }
      });
    }
  }

  get templateRef(): TemplateRef<OverlaySurfaceContext> {
    return this.tpl;
  }
}
