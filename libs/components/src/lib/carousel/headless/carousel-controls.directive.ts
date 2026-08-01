import { DestroyRef, Directive, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CAROUSEL_AUTOPLAY_TOKEN, CAROUSEL_TOKEN } from './carousel.tokens';

/** `'CarouselNextDirective'` → the `etCarouselNext` selector it is applied with. */
const selectorOf = (directiveName: string) => `et${directiveName.replace('Directive', '')}`;

const assertInsideCarousel = (hasCarousel: boolean, directiveName: string) => {
  if (ngDevMode) {
    afterNextRender(() => {
      if (!hasCarousel) {
        throw new RuntimeError(
          CAROUSEL_ERROR_CODES.PART_OUTSIDE_CAROUSEL,
          `[${directiveName}] ${selectorOf(directiveName)} must be placed inside an [etCarousel] element ` +
            '(e.g. <et-carousel>).',
        );
      }
    });
  }
};

/**
 * Moves the carousel one slide back. Put it on a `<button>`; it labels itself, and reports
 * `aria-disabled` at the first slide of a carousel that doesn't loop rather than going native-disabled, so
 * the control keeps its place in the tab order.
 */
@Directive({
  selector: '[etCarouselPrevious]',
  exportAs: 'etCarouselPrevious',
  host: {
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : null',
    '(click)': 'go()',
  },
})
export class CarouselPreviousDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });

  protected label = computed(() => this.carousel?.resolvedLabels().previous ?? null);
  protected isDisabled = computed(() => !(this.carousel?.canGoPrevious() ?? false));

  constructor() {
    assertInsideCarousel(!!this.carousel, 'CarouselPreviousDirective');
  }

  protected go() {
    this.carousel?.previous();
  }
}

/** Moves the carousel one slide on. Mirror of {@link CarouselPreviousDirective}. */
@Directive({
  selector: '[etCarouselNext]',
  exportAs: 'etCarouselNext',
  host: {
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : null',
    '(click)': 'go()',
  },
})
export class CarouselNextDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });

  protected label = computed(() => this.carousel?.resolvedLabels().next ?? null);
  protected isDisabled = computed(() => !(this.carousel?.canGoNext() ?? false));

  constructor() {
    assertInsideCarousel(!!this.carousel, 'CarouselNextDirective');
  }

  protected go() {
    this.carousel?.next();
  }
}

/**
 * Stops and restarts autoplay - the control WCAG 2.2.2 requires whenever a carousel moves on its own.
 * Registering it is what satisfies the dev-mode check in `etCarouselAutoplay`.
 *
 * Its label and `aria-pressed` follow the state, so one button covers both directions.
 *
 * It also tells autoplay when the pointer or focus is on *it*, which is what keeps pressing play from
 * being cancelled by the hover/focus pause it was pressed with - see `isPointerOnPauseControl`.
 */
@Directive({
  selector: '[etCarouselPlayToggle]',
  exportAs: 'etCarouselPlayToggle',
  host: {
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.aria-pressed]': 'isPlaying()',
    '(click)': 'toggle()',
    '(mouseenter)': 'setPointerOn(true)',
    '(mouseleave)': 'setPointerOn(false)',
    '(focus)': 'setFocusOn(true)',
    '(blur)': 'setFocusOn(false)',
  },
})
export class CarouselPlayToggleDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });
  private autoplay = inject(CAROUSEL_AUTOPLAY_TOKEN, { optional: true });

  /** Whether autoplay is currently running - the pressed state of the control. */
  public isPlaying = computed(() => !(this.autoplay?.isStopped() ?? true));

  protected label = computed(() => {
    const labels = this.carousel?.resolvedLabels();

    if (!labels) return null;

    return this.isPlaying() ? labels.pause : labels.play;
  });

  constructor() {
    const autoplay = this.autoplay;

    if (autoplay) {
      autoplay.pauseControl.set(this);

      inject(DestroyRef).onDestroy(() => {
        if (autoplay.pauseControl() === this) {
          autoplay.pauseControl.set(null);
        }
      });
    }

    assertInsideCarousel(!!this.carousel, 'CarouselPlayToggleDirective');
  }

  protected toggle() {
    this.autoplay?.toggle();
  }

  protected setPointerOn(isOn: boolean) {
    this.autoplay?.isPointerOnPauseControl.set(isOn);
  }

  protected setFocusOn(isOn: boolean) {
    this.autoplay?.isFocusOnPauseControl.set(isOn);
  }
}
