import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { CAROUSEL_ITEM_TOKEN, CarouselItemDirective } from './et-carousel-item.directive';

@Component({
  selector: 'et-carousel-item',
  template: ` <ng-content /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [{ directive: CarouselItemDirective, inputs: ['autoPlayTime'] }],
})
export class CarouselItemComponent {
  carouselItem = inject(CAROUSEL_ITEM_TOKEN);
}
