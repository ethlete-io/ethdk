import { Directive, InjectionToken } from '@angular/core';

export const CAROUSEL_NEXT_BUTTON_TOKEN = new InjectionToken<CarouselNextButtonDirective>('CAROUSEL_NEXT_BUTTON_TOKEN');

@Directive({
  selector: '[etCarouselNextButton]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_NEXT_BUTTON_TOKEN,
      useExisting: CarouselNextButtonDirective,
    },
  ],
})
export class CarouselNextButtonDirective {}
