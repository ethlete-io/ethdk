import { Directive, InjectionToken, inject } from '@angular/core';
import { CAROUSEL_TOKEN } from '../carousel.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CAROUSEL_ITEM_NAV_TOKEN = new InjectionToken<CarouselItemNavDirective>('CAROUSEL_ITEM_NAV_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
