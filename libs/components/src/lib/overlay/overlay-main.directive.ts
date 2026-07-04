import { Directive, ElementRef, InjectionToken, OnInit, booleanAttribute, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export const OVERLAY_MAIN_TOKEN = new InjectionToken<OverlayMainDirective>('OVERLAY_MAIN_TOKEN');

@Directive({
  selector: '[etOverlayMain], et-overlay-main',
  providers: [
    {
      provide: OVERLAY_MAIN_TOKEN,
      useExisting: OverlayMainDirective,
    },
  ],
  host: {
    '[class.et-overlay-main]': 'enabled()',
  },
})
export class OverlayMainDirective implements OnInit {
  private parent = inject(OVERLAY_MAIN_TOKEN, { optional: true, skipSelf: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });

  public enabled = input(true, { alias: 'etOverlayMain', transform: booleanAttribute });
  private overlayManager = injectOverlayManager();

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });

    if (this.parent) {
      if (this.overlayRef.id === this.parent.overlayRef?.id && this.parent.enabled() && this.enabled()) {
        throw new RuntimeError(
          OVERLAY_ERROR_CODES.NESTED_OVERLAY_MAIN,
          '[OverlayMainDirective] An overlay must not contain nested <et-overlay-main> elements or etOverlayMain directives.',
        );
      }
    }
  }
}
