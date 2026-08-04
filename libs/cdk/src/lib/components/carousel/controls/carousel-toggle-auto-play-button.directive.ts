import { Directive, InjectionToken, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHostElement, signalHostClasses } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { CAROUSEL_TOKEN } from '../carousel.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN = new InjectionToken<CarouselToggleAutoPlayButtonDirective>(
  'CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etCarouselToggleAutoPlayButton]',

  providers: [
    {
      provide: CAROUSEL_TOGGLE_AUTO_PLAY_BUTTON_TOKEN,
      useExisting: CarouselToggleAutoPlayButtonDirective,
    },
  ],
  host: {
    class: 'et-carousel-toggle-auto-play-button et-legacy',
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
