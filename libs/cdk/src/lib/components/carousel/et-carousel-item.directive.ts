import { Directive, InjectionToken, computed, inject, input, numberAttribute } from '@angular/core';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { CAROUSEL_TOKEN } from './carousel.directive';

export const CAROUSEL_ITEM_TOKEN = new InjectionToken<CarouselItemDirective>('CAROUSEL_ITEM_TOKEN');

@Directive({
  selector: '[etCarouselItem]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_ITEM_TOKEN,
      useExisting: CarouselItemDirective,
    },
  ],
  host: {
    class: 'et-carousel-item',
  },
})
export class CarouselItemDirective {
  autoPlayTime = input(null, { transform: numberAttribute });

  carousel = inject(CAROUSEL_TOKEN);

  itemIndex = computed(() => this.carousel.items().indexOf(this));
  isPreviousActive = computed(
    () => this.carousel.previousActiveIndex() === this.itemIndex() && this.carousel.isNavigationLocked(),
  );

  hostClassBindings = signalHostClasses({
    active: computed(() => this.itemIndex() === this.carousel.activeIndex()),
    'previous-active': this.isPreviousActive,
  });

  hostAttributeBindings = signalHostAttributes({
    inert: computed(() => this.itemIndex() !== this.carousel.activeIndex()),
    'aria-hidden': computed(() => this.itemIndex() !== this.carousel.activeIndex()),
  });
}
