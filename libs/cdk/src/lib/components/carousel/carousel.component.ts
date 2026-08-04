import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { CAROUSEL_TOKEN, CarouselDirective } from './carousel.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-carousel',
  template: `
    <div class="et-carousel">
      <div #carouselItemsWrapper class="et-carousel-items">
        <ng-content select="et-carousel-item, [etCarouselItem]" />
      </div>

      <ng-content />
    </div>
  `,
  styleUrl: './carousel.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-host et-legacy',
  },
  hostDirectives: [
    {
      directive: CarouselDirective,
      inputs: [
        'loop',
        'autoPlay',
        'autoPlayTime',
        'pauseAutoPlayOnHover',
        'pauseAutoPlayOnFocus',
        'pauseAutoPlayOnHidden',
        'transitionType',
        'transitionDuration',
      ],
    },
  ],
})
export class CarouselComponent {
  carousel = inject(CAROUSEL_TOKEN);
  carouselItemsWrapper = viewChild.required<ElementRef<HTMLElement>>('carouselItemsWrapper');

  constructor() {
    syncSignal(this.carouselItemsWrapper, this.carousel.carouselItemsWrapper, { skipSyncRead: true });
  }
}
