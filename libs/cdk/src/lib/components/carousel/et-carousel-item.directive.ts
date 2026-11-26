import { Directive, InjectionToken, computed, inject, input, numberAttribute } from '@angular/core';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { CAROUSEL_TOKEN } from './carousel.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CAROUSEL_ITEM_TOKEN = new InjectionToken<CarouselItemDirective>('CAROUSEL_ITEM_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etCarouselItem]',

  providers: [
    {
      provide: CAROUSEL_ITEM_TOKEN,
      useExisting: CarouselItemDirective,
    },
  ],
  host: {
    class: 'et-carousel-item et-legacy',
  },
})
export class CarouselItemDirective {
  autoPlayTime = input(null, { transform: numberAttribute });

  carousel = inject(CAROUSEL_TOKEN);

  itemIndex = computed(() => this.carousel.items().indexOf(this));
  isPreviousActive = computed(
    () => this.carousel.previousActiveIndex() === this.itemIndex() && this.carousel.isNavigationLocked(),
  );

  isActive = computed(() => this.itemIndex() === this.carousel.activeIndex());

  hostClassBindings = signalHostClasses({
    active: this.isActive,
    'previous-active': this.isPreviousActive,
  });

  hostAttributeBindings = signalHostAttributes({
    inert: computed(() => !this.isActive()),
    'aria-hidden': computed(() => !this.isActive()),
  });
}
