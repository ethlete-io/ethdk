import { Location } from '@angular/common';
import { Directive, ElementRef, InjectionToken, booleanAttribute, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  locationService = inject(Location);
  overlayRef = inject(OverlayRef);
  router = inject(OverlayRouterService);
  disabled = input(false, { transform: booleanAttribute });

  constructor() {
    fromEvent<PointerEvent>(inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement, 'click')
      .pipe(
        filter(() => !this.disabled()),
        tap(() => this.locationService.back()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
