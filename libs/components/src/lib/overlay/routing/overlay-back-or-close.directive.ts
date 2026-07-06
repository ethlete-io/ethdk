import { Directive, ElementRef, InjectionToken, booleanAttribute, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, tap } from 'rxjs';
import { OVERLAY_REF } from '../overlay-ref';
import { injectOverlayRouter } from './overlay-router';

export const OVERLAY_BACK_OR_CLOSE_TOKEN = new InjectionToken<OverlayBackOrCloseDirective>(
  'OVERLAY_BACK_OR_CLOSE_TOKEN',
);

@Directive({
  selector: '[etOverlayBackOrClose]',
  providers: [
    {
      provide: OVERLAY_BACK_OR_CLOSE_TOKEN,
      useExisting: OverlayBackOrCloseDirective,
    },
  ],
  host: {
    class: 'et-overlay-back-or-close',
    type: 'button',
  },
})
export class OverlayBackOrCloseDirective {
  private overlayRef = inject(OVERLAY_REF);
  private elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  private router = injectOverlayRouter();
  public disabled = input(false, { transform: booleanAttribute });

  constructor() {
    fromEvent<PointerEvent>(this.elementRef.nativeElement, 'click')
      .pipe(
        filter(() => !this.disabled()),
        tap(() => {
          if (!this.router.back()) {
            this.overlayRef.close();
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
