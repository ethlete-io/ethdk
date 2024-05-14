import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { CAROUSEL_ITEM_NAV_TOKEN, CarouselItemNavDirective } from './carousel-item-nav.directive';

@Component({
  selector: 'et-carousel-item-nav',
  template: `
    <ul class="et-carousel-item-nav">
      @for (item of nav.carousel.items(); track $index) {
        <li class="et-carousel-item-nav-item">
          <button
            [class.et-carousel-item-nav-button--progressing]="item.isActive() && nav.autoPlayEnabled()"
            [class.et-carousel-item-nav-button--active-static]="item.isActive() && !nav.autoPlayEnabled()"
            (click)="nav.goTo($index)"
            class="et-carousel-item-nav-button"
            type="button"
          >
            <div
              [style.--_et-carousel-item-nav-button-progress]="item.isActive() ? nav.autoPlayProgress() : 0"
              class="et-carousel-item-nav-button-progress"
            ></div>
          </button>
        </li>
      }
    </ul>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-item-nav-host',
  },
  imports: [],
  hostDirectives: [{ directive: CarouselItemNavDirective }],
})
export class CarouselItemNavComponent {
  nav = inject(CAROUSEL_ITEM_NAV_TOKEN);
}
