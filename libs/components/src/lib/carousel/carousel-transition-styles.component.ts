import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The slide-transition system — the progress property, the scroll-driven driver and the effects that read
 * it — as a styles-only component mounted by `etCarousel` the first time a transition is asked for (see
 * `ButtonStylesDirective` for the pattern).
 *
 * Mounted rather than shipped with `<et-carousel>` for two reasons: a carousel with `transition="none"`
 * injects none of it, and a headless carousel gets it too — the progress property has to be *registered*
 * to interpolate in keyframes, so a consumer writing their own effect needs this even though they wrote
 * no chrome.
 *
 * @internal
 */
@Component({
  selector: 'et-carousel-transition-styles',
  template: '',
  styleUrl: './carousel-transition-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CarouselTransitionStylesComponent {}
