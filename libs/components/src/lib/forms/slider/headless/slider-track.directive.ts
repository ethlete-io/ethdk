import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { nearestThumbIndex, valueFromPointerPosition } from './internals/slider-engine';
import { SLIDER_TOKEN } from './slider.tokens';

/**
 * The pointer surface of a slider: its rect maps horizontal pointer positions onto
 * the value range. Place the thumbs inside it so their pointer events bubble here.
 */
@Directive({
  selector: '[etSliderTrack]',
  exportAs: 'etSliderTrack',
  host: {
    // horizontal drags adjust the slider, vertical page scrolling stays native
    '[style.touch-action]': '"pan-y"',
    '(pointerdown)': 'handlePointerDown($event)',
    '(pointermove)': 'handlePointerMove($event)',
    '(pointerup)': 'handlePointerUp($event)',
    '(pointercancel)': 'handlePointerCancel()',
  },
})
export class SliderTrackDirective {
  private slider = inject(SLIDER_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.slider) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.TRACK_OUTSIDE_SLIDER,
            'An [etSliderTrack] must be placed inside an [etSlider] or [etRangeSlider].',
          );
        }
      });
    }
  }

  protected handlePointerDown(event: PointerEvent) {
    const slider = this.slider;

    if (!slider || !slider.interactive() || event.button !== 0) {
      return;
    }

    const value = this.valueFromEvent(event);
    const index = nearestThumbIndex(value, slider.thumbValues());

    slider.draggingThumbIndex.set(index);
    slider.commitThumbValue(index, value);
    slider.thumbs()[index]?.focus();

    try {
      this.elementRef.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture is unavailable in some test environments — dragging still works
    }

    // keep the interaction from selecting text or starting a native drag
    event.preventDefault();
  }

  protected handlePointerMove(event: PointerEvent) {
    const slider = this.slider;
    const draggingIndex = slider?.draggingThumbIndex() ?? null;

    if (!slider || draggingIndex === null) {
      return;
    }

    slider.commitThumbValue(draggingIndex, this.valueFromEvent(event));
  }

  protected handlePointerUp(event: PointerEvent) {
    const slider = this.slider;
    const draggingIndex = slider?.draggingThumbIndex() ?? null;

    if (!slider || draggingIndex === null) {
      return;
    }

    slider.commitThumbValue(draggingIndex, this.valueFromEvent(event));
    slider.draggingThumbIndex.set(null);
  }

  protected handlePointerCancel() {
    this.slider?.draggingThumbIndex.set(null);
  }

  private valueFromEvent(event: PointerEvent) {
    const slider = this.slider;

    if (!slider) {
      return 0;
    }

    const element = this.elementRef.nativeElement;

    return valueFromPointerPosition({
      clientX: event.clientX,
      trackRect: element.getBoundingClientRect(),
      rtl: getComputedStyle(element).direction === 'rtl',
      bounds: { min: slider.effectiveMin(), max: slider.effectiveMax(), step: slider.step() },
    });
  }
}
