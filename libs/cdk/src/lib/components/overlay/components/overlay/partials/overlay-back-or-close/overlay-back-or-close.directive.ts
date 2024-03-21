import { Directive, ElementRef, InjectionToken, booleanAttribute, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRef, OverlayRouterService } from '../../utils';

export const OVERLAY_BACK_OR_CLOSE_TOKEN = new InjectionToken<OverlayBackOrCloseDirective>(
  'OVERLAY_BACK_OR_CLOSE_TOKEN',
);

@Directive({
  selector: '[etOverlayBackOrClose]',
  standalone: true,
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
  overlayRef = inject(OverlayRef);
  router = inject(OverlayRouterService);
  disabled = input(false, { transform: booleanAttribute });

  hostClassBindings = signalHostClasses({
    'et-overlay-back-or-close--is-back': this.router.canGoBack,
    'et-overlay-back-or-close--is-close': computed(() => !this.router.canGoBack()),
  });

  constructor() {
    fromEvent<PointerEvent>(inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement, 'click')
      .pipe(
        filter(() => !this.disabled()),
        tap(() => {
          if (this.router.canGoBack()) {
            this.router.back();
          } else {
            this.overlayRef.close();
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
