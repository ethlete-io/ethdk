import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { CAROUSEL_TOKEN, CarouselDirective } from './carousel.directive';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-host',
  },
  imports: [NgTemplateOutlet],
  hostDirectives: [
    {
      directive: CarouselDirective,
      inputs: [
        'loop',
        'autoPlay',
        'autoPlayTime',
        'pauseAutoPlayOnHover',
        'pauseAutoPlayOnFocus',
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
