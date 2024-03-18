import {
  Directive,
  InjectionToken,
  TemplateRef,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { CAROUSEL_TOKEN } from './carousel.directive';

export const CAROUSEL_ITEM_TOKEN = new InjectionToken<CarouselItemDirective>('CAROUSEL_ITEM_TOKEN');

@Directive({
  selector: '[etCarouselItem]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_ITEM_TOKEN,
      useExisting: CarouselItemDirective,
    },
  ],
})
export class CarouselItemDirective {
  autoPlayTime = input(null, { transform: numberAttribute });
  itemTemplate = signal<TemplateRef<unknown> | null>(null);

  carousel = inject(CAROUSEL_TOKEN);

  itemIndex = computed(() => this.carousel.items().indexOf(this));
  isPreviousActive = computed(
    () => this.carousel.previousActiveIndex() === this.itemIndex() && this.carousel.isNavigationLocked(),
  );
}
