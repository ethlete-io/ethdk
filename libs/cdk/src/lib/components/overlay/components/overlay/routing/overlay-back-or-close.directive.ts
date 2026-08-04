import { Location } from '@angular/common';
import { Directive, ElementRef, InjectionToken, booleanAttribute, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRef } from '../overlay-ref';
import { OverlayRouterService } from './overlay-router';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OVERLAY_BACK_OR_CLOSE_TOKEN = new InjectionToken<OverlayBackOrCloseDirective>(
  'OVERLAY_BACK_OR_CLOSE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etOverlayBackOrClose]',
  providers: [
    {
      provide: OVERLAY_BACK_OR_CLOSE_TOKEN,
      useExisting: OverlayBackOrCloseDirective,
    },
  ],
  host: {
    class: 'et-overlay-back-or-close et-legacy',
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
