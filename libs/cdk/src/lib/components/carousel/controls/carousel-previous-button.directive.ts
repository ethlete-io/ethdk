import { Directive, InjectionToken } from '@angular/core';

export const CAROUSEL_PREVIOUS_BUTTON_TOKEN = new InjectionToken<CarouselPreviousButtonDirective>(
  'CAROUSEL_PREVIOUS_BUTTON_TOKEN',
);

@Directive({
  selector: '[etCarouselPreviousButton]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_PREVIOUS_BUTTON_TOKEN,
      useExisting: CarouselPreviousButtonDirective,
    },
  ],
})
export class CarouselPreviousButtonDirective {}
