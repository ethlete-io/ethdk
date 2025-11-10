import { Directive, InjectionToken, inject } from '@angular/core';
import { CAROUSEL_TOKEN } from '../carousel.directive';

export const CAROUSEL_ITEM_NAV_TOKEN = new InjectionToken<CarouselItemNavDirective>('CAROUSEL_ITEM_NAV_TOKEN');

@Directive({
  providers: [
    {
      provide: CAROUSEL_ITEM_NAV_TOKEN,
      useExisting: CarouselItemNavDirective,
    },
  ],
})
export class CarouselItemNavDirective {
  carousel = inject(CAROUSEL_TOKEN);

  autoPlayProgress = this.carousel.activeItemAutoPlayProgress;
  autoPlayEnabled = this.carousel.autoPlay;

  goTo(index: number) {
    this.carousel.goTo(index);
  }
}
