import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHostElement, signalHostClasses } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { CAROUSEL_TOKEN } from '../carousel.directive';

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
  host: {
    class: 'et-carousel-toggle-auto-play-button',
  },
})
export class CarouselToggleAutoPlayButtonDirective {
  carousel = inject(CAROUSEL_TOKEN);

  hostClassBindings = signalHostClasses({
    'et-carousel-toggle-auto-play-button--playing': computed(() => !this.carousel.isAutoPlayPaused()),
    'et-carousel-toggle-auto-play-button--paused': computed(() => this.carousel.isAutoPlayPaused()),
  });

  constructor() {
    fromEvent(injectHostElement(), 'click')
      .pipe(
        takeUntilDestroyed(),
        tap(() => (this.carousel.isAutoPlayPaused() ? this.carousel.resumeAutoPlay() : this.carousel.stopAutoPlay())),
      )
      .subscribe();
  }
}
