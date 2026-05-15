import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { OverlayDirective } from './overlay.directive';

@Directive({
  selector: '[etOverlayTrigger]',
  exportAs: 'etOverlayTrigger',
  host: {
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.data-overlay-open]': 'isOpen() || null',
  },
})
export class OverlayTriggerDirective {
  private overlay = inject(OverlayDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.overlay?.registeredTrigger.set(this);

    this.destroyRef.onDestroy(() => {
      this.overlay?.unregisterTrigger(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.overlay) {
          throw new RuntimeError(
            OVERLAY_ERROR_CODES.TRIGGER_OUTSIDE_OVERLAY,
            '[OverlayTriggerDirective] etOverlayTrigger must be placed inside an [etOverlay] element.',
          );
        }
      });
    }
  }

  get elementRef() {
    return this.hostElement;
  }

  toggle() {
    this.overlay?.toggle();
  }

  isOpen() {
    return this.overlay?.open() ?? false;
  }

  expanded() {
    return this.overlay?.open() ?? null;
  }
}
