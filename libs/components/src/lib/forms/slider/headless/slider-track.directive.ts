import { Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { nearestThumbIndex, valueFromPointerPosition } from './internals/slider-engine';
import { SLIDER_MARK_VALUE_ATTRIBUTE, SLIDER_TOKEN } from './slider.tokens';

/** The exact stop a tick element under the pointer carries, or `null` for a plain track position. */
const markValueUnderPointer = (event: PointerEvent) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  // eslint-disable-next-line ethlete/no-dom-query -- pointer hit-testing: the pressed node may be any descendant of a tick (e.g. its label), and ticks are plain markup carrying no directive token
  const mark = target.closest(`[${SLIDER_MARK_VALUE_ATTRIBUTE}]`);
  const value = mark ? Number(mark.getAttribute(SLIDER_MARK_VALUE_ATTRIBUTE)) : NaN;

  return Number.isFinite(value) ? value : null;
};

/**
 * The pointer surface of a slider: its rect maps pointer positions along the slider's
 * axis onto the value range. Place the thumbs inside it so their pointer events bubble here.
 */
@Directive({
  selector: '[etSliderTrack]',
  exportAs: 'etSliderTrack',
  host: {
    // drags along the slider axis adjust it, page scrolling on the other axis stays native
    '[style.touch-action]': 'vertical() ? "pan-x" : "pan-y"',
    '(pointerdown)': 'handlePointerDown($event)',
    '(pointermove)': 'handlePointerMove($event)',
    '(pointerup)': 'handlePointerUp($event)',
    '(pointercancel)': 'handlePointerCancel()',
  },
})
export class SliderTrackDirective {
  private slider = inject(SLIDER_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected vertical = computed(() => this.slider?.orientation() === 'vertical');

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

    // a tap that starts on a tick commits that tick exactly, not the value under the pointer
    const value = markValueUnderPointer(event) ?? this.valueFromEvent(event);
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
      clientY: event.clientY,
      trackRect: element.getBoundingClientRect(),
      rtl: getComputedStyle(element).direction === 'rtl',
      orientation: slider.orientation(),
      bounds: { min: slider.effectiveMin(), max: slider.effectiveMax(), step: slider.step() },
    });
  }
}
