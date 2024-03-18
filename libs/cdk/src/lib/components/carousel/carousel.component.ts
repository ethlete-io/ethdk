import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { CAROUSEL_TOKEN, CarouselDirective } from './carousel.directive';

@Component({
  selector: 'et-carousel',
  template: `
    <ng-template>
      <ng-content />
    </ng-template>

    <div class="et-carousel">
      <div #carouselItemsWrapper class="et-carousel-items">
        @for (item of carousel.items(); track $index) {
          <div
            [attr.inert]="item.itemIndex() !== carousel.activeIndex() ? 'true' : null"
            [attr.aria-hidden]="item.itemIndex() !== carousel.activeIndex()"
            [class.active]="carousel.activeIndex() === $index"
            [class.previous-active]="item.isPreviousActive()"
            class="et-carousel-item"
          >
            <ng-container *ngTemplateOutlet="item.itemTemplate()" />
          </div>
        }
      </div>

      <div class="et-carousel-controls">
        <button (click)="carousel.prev()" class="et-carousel-control">Prev</button>
        <button (click)="carousel.next()" class="et-carousel-control">Next</button>
        <button (click)="carousel.resumeAutoPlay()" class="et-carousel-control">Play</button>
        <button (click)="carousel.stopAutoPlay()" class="et-carousel-control">Pause</button>
      </div>

      <ng-content select="[navStuff]" />
    </div>
  `,
  styleUrl: './carousel.component.scss',
  standalone: true,
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
    syncSignal(this.carouselItemsWrapper, this.carousel.carouselItemsWrapper);
  }
}
