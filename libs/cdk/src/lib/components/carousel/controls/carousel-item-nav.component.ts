import { Component, ElementRef, ViewEncapsulation, computed, inject, viewChildren } from '@angular/core';
import { signalStyles } from '@ethlete/core';
import { CAROUSEL_ITEM_NAV_TOKEN, CarouselItemNavDirective } from './carousel-item-nav.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
            <div #progress class="et-carousel-item-nav-button-progress"></div>
          </button>
        </li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-carousel-item-nav-host et-legacy',
  },
  hostDirectives: [{ directive: CarouselItemNavDirective }],
})
export class CarouselItemNavComponent {
  nav = inject(CAROUSEL_ITEM_NAV_TOKEN);

  progressBars = viewChildren<ElementRef<HTMLElement>[]>('progress');
  activeProgressBar = computed(() => this.progressBars()[this.nav.carousel.activeIndex()]);

  progressBarStyleBindings = signalStyles(this.activeProgressBar, {
    '--_et-carousel-item-nav-button-progress': this.nav.autoPlayProgress,
  });
}
