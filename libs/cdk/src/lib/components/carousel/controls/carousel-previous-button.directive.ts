import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHostElement, signalHostAttributes } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { CAROUSEL_TOKEN } from '../carousel.directive';

export const CAROUSEL_PREVIOUS_BUTTON_TOKEN = new InjectionToken<CarouselPreviousButtonDirective>(
  'CAROUSEL_PREVIOUS_BUTTON_TOKEN',
);

@Directive({
  selector: '[etCarouselPreviousButton]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_PREVIOUS_BUTTON_TOKEN,
      useExisting: CarouselPreviousButtonDirective,
    },
  ],
  host: {
    class: 'et-carousel-previous-button',
  },
})
export class CarouselPreviousButtonDirective {
  carousel = inject(CAROUSEL_TOKEN);

  readonly isButton = injectHostElement().tagName === 'BUTTON';

  canGoPrevious = computed(() => this.carousel.loop() || !this.carousel.isAtStart());

  hostAttributeBindings = signalHostAttributes({
    disabled: computed(() => (this.isButton ? !this.canGoPrevious() : false)),
    'aria-disabled': computed(() => !this.canGoPrevious()),
  });

  constructor() {
    fromEvent(injectHostElement(), 'click')
      .pipe(
        takeUntilDestroyed(),
        filter(() => this.canGoPrevious()),
        tap(() => this.carousel.prev()),
      )
      .subscribe();
  }
}
