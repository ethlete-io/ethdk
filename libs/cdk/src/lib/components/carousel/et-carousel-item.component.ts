import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CAROUSEL_ITEM_TOKEN, CarouselItemDirective } from './et-carousel-item.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-carousel-item',
  template: ` <ng-content /> `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: CarouselItemDirective, inputs: ['autoPlayTime'] }],
})
export class CarouselItemComponent {
  carouselItem = inject(CAROUSEL_ITEM_TOKEN);
}
