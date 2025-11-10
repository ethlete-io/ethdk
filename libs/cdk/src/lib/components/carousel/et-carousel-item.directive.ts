import { Directive, InjectionToken, computed, inject, input, numberAttribute } from '@angular/core';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { CAROUSEL_TOKEN } from './carousel.directive';

export const CAROUSEL_ITEM_TOKEN = new InjectionToken<CarouselItemDirective>('CAROUSEL_ITEM_TOKEN');

@Directive({
  selector: '[etCarouselItem]',

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

  isActive = computed(() => this.itemIndex() === this.carousel.activeIndex());

  hostClassBindings = signalHostClasses({
    active: this.isActive,
    'previous-active': this.isPreviousActive,
  });

  hostAttributeBindings = signalHostAttributes({
    inert: computed(() => !this.isActive()),
    'aria-hidden': computed(() => !this.isActive()),
  });
}
