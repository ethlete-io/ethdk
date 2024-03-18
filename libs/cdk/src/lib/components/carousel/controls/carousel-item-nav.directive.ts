import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { CAROUSEL_TOKEN } from '../carousel.directive';

export const CAROUSEL_ITEM_NAV_TOKEN = new InjectionToken<CarouselItemNavDirective>('CAROUSEL_ITEM_NAV_TOKEN');

@Directive({
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_ITEM_NAV_TOKEN,
      useExisting: CarouselItemNavDirective,
    },
  ],
})
export class CarouselItemNavDirective {
  carousel = inject(CAROUSEL_TOKEN);

  items = computed(() => {
    const carouselItems = this.carousel.items();

    return carouselItems.map((item, index) => ({
      item,
      isActive: this.carousel.activeIndex() === index,
    }));
  });

  autoPlayProgress = this.carousel.activeItemAutoPlayProgress;

  goTo(index: number) {
    this.carousel.goTo(index);
  }
}
