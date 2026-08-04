import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHostElement, signalHostAttributes } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { CAROUSEL_TOKEN } from '../carousel.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CAROUSEL_NEXT_BUTTON_TOKEN = new InjectionToken<CarouselNextButtonDirective>('CAROUSEL_NEXT_BUTTON_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etCarouselNextButton]',

  providers: [
    {
      provide: CAROUSEL_NEXT_BUTTON_TOKEN,
      useExisting: CarouselNextButtonDirective,
    },
  ],
  host: {
    class: 'et-carousel-next-button et-legacy',
  },
})
export class CarouselNextButtonDirective {
  carousel = inject(CAROUSEL_TOKEN);

  readonly isButton = injectHostElement().tagName === 'BUTTON';

  canGoNext = computed(() => this.carousel.loop() || !this.carousel.isAtEnd());

  hostAttributeBindings = signalHostAttributes({
    disabled: computed(() => (this.isButton ? !this.canGoNext() : false)),
    'aria-disabled': computed(() => !this.canGoNext()),
  });

  constructor() {
    fromEvent(injectHostElement(), 'click')
      .pipe(
        takeUntilDestroyed(),
        filter(() => this.canGoNext()),
        tap(() => this.carousel.next()),
      )
      .subscribe();
  }
}
