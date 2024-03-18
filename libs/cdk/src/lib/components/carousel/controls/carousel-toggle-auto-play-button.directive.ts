import { Directive, InjectionToken } from '@angular/core';

export const CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN = new InjectionToken<CarouselToggleAutoPlayButtonDirective>(
  'CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN',
);

@Directive({
  selector: '[etCarouselToggleAutoPlayButton]',
  standalone: true,
  providers: [
    {
      provide: CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN,
      useExisting: CarouselToggleAutoPlayButtonDirective,
    },
  ],
})
export class CarouselToggleAutoPlayButtonDirective {}
