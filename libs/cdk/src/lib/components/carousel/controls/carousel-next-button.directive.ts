import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHostElement, signalHostAttributes } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { CAROUSEL_TOKEN } from '../carousel.directive';

export const CAROUSEL_NEXT_BUTTON_TOKEN = new InjectionToken<CarouselNextButtonDirective>('CAROUSEL_NEXT_BUTTON_TOKEN');

@Directive({
  selector: '[etCarouselNextButton]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_NEXT_BUTTON_TOKEN,
      useExisting: CarouselNextButtonDirective,
    },
  ],
  host: {
    class: 'et-carousel-next-button',
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
