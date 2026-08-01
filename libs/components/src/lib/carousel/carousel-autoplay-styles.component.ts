import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The autoplay chrome - the countdown ring around the dots and the play/pause toggle's icon cross-fade -
 * as a styles-only component mounted by `etCarouselAutoplay` once autoplay is actually enabled (see
 * `CarouselTransitionStylesComponent` for the pattern).
 *
 * @internal
 */
@Component({
  selector: 'et-carousel-autoplay-styles',
  template: '',
  styleUrl: './carousel-autoplay-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CarouselAutoplayStylesComponent {}
