import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DragGestureEvent, RuntimeError, dragGestureFrom } from '@ethlete/core';
import { tap } from 'rxjs';
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
  },
})
export class SliderTrackDirective {
  private slider = inject(SLIDER_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  protected vertical = computed(() => this.slider?.orientation() === 'vertical');

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.slider) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.TRACK_OUTSIDE_SLIDER,
            'An [etSliderTrack] must be placed inside an [etSlider] or [etRangeSlider].',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected handlePointerDown(event: PointerEvent) {
    const slider = this.slider;

    if (!slider || !slider.interactive() || event.button !== 0 || slider.draggingThumbIndex() !== null) {
      return;
    }

    // a tap that starts on a tick commits that tick exactly, not the value under the pointer
    const pressValue = markValueUnderPointer(event) ?? this.valueFromPosition(event.clientX, event.clientY);
    const index = nearestThumbIndex(pressValue, slider.thumbValues());

    slider.draggingThumbIndex.set(index);
    slider.commitThumbValue(index, pressValue);
    slider.thumbs()[index]?.focus({ origin: 'pointer' });

    // keep the interaction from selecting text or starting a native drag
    event.preventDefault();

    // every pointer move counts: a slider follows the pointer from the first pixel, so there is
    // no threshold below which the press is still just a click
    dragGestureFrom(event, this.elementRef.nativeElement, { commitThreshold: 0 })
      .pipe(
        tap((gesture) => this.applyGesture(gesture, { index, pressValue })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private applyGesture(gesture: DragGestureEvent, press: { index: number; pressValue: number }) {
    const slider = this.slider;

    if (!slider) {
      return;
    }

    switch (gesture.type) {
      case 'start':
        return;
      case 'move':
        slider.commitThumbValue(press.index, this.valueFromPosition(gesture.data.clientX, gesture.data.clientY));

        return;
      case 'end':
        slider.commitThumbValue(press.index, this.valueFromPosition(gesture.data.clientX, gesture.data.clientY));
        slider.draggingThumbIndex.set(null);

        return;
      case 'cancelled':
        // the browser took the gesture away - the last position the user chose is the one they pressed
        slider.commitThumbValue(press.index, press.pressValue);
        slider.draggingThumbIndex.set(null);

        return;
      case 'tapped':
        slider.draggingThumbIndex.set(null);

        return;
    }
  }

  private valueFromPosition(clientX: number, clientY: number) {
    const slider = this.slider;

    if (!slider) {
      return 0;
    }

    const element = this.elementRef.nativeElement;

    return valueFromPointerPosition({
      clientX,
      clientY,
      trackRect: element.getBoundingClientRect(),
      rtl: getComputedStyle(element).direction === 'rtl',
      orientation: slider.orientation(),
      bounds: { min: slider.effectiveMin(), max: slider.effectiveMax(), step: slider.step() },
    });
  }
}
