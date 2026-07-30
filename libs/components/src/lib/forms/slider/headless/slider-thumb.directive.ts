import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { SLIDER_TOKEN, SliderThumbBase } from './slider.tokens';

const PAGE_STEP_MULTIPLIER = 10;

/**
 * A slider thumb: carries the ARIA slider semantics and the keyboard model.
 * Registration order determines its index — for ranges, place the start thumb first.
 */
@Directive({
  selector: '[etSliderThumb]',
  exportAs: 'etSliderThumb',
  host: {
    role: 'slider',
    'aria-orientation': 'horizontal',
    '[attr.tabindex]': 'slider?.disabled() ? -1 : 0',
    '[attr.aria-valuemin]': 'ariaMin()',
    '[attr.aria-valuemax]': 'ariaMax()',
    // a removed aria-valuenow is the ARIA-sanctioned "indeterminate value" — the valuetext
    // then carries the mixed label so assistive tech announces the bulk-edit state
    '[attr.aria-valuenow]': 'slider?.mixed() ? null : value()',
    '[attr.aria-valuetext]': 'slider?.mixed() ? slider?.resolvedMixedLabel() : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-labelledby]': 'label() ? null : slider?.labelId()',
    '[attr.aria-describedby]': 'slider?.describedBy()',
    '[attr.aria-disabled]': 'slider?.disabled() || null',
    '[attr.aria-readonly]': 'slider?.readonly() || null',
    '[attr.aria-invalid]': 'slider?.shouldDisplayError() || null',
    '[attr.data-disabled]': 'slider?.disabled() || null',
    '[attr.data-readonly]': 'slider?.readonly() || null',
    '[attr.data-dragging]': 'dragging() || null',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'focused.set(true)',
    '(blur)': 'handleBlur()',
  },
})
export class SliderThumbDirective implements SliderThumbBase {
  protected slider = inject(SLIDER_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** Accessible name of the thumb — range thumbs need one each (e.g. "Minimum"). */
  public label = input('');

  public focused = signal(false);

  public index = computed(() => this.slider?.thumbs().indexOf(this) ?? -1);

  public value = computed(() => this.slider?.thumbValues()[this.index()] ?? 0);

  /** The thumb's position on the track as a 0–100 percentage. */
  public percent = computed(() => this.slider?.thumbPercents()[this.index()] ?? 0);

  public dragging = computed(() => this.slider !== null && this.slider.draggingThumbIndex() === this.index());

  protected ariaMin = computed(() => this.slider?.thumbAriaBounds(this.index()).min ?? 0);
  protected ariaMax = computed(() => this.slider?.thumbAriaBounds(this.index()).max ?? 100);

  constructor() {
    this.slider?.registerThumb(this);
    this.destroyRef.onDestroy(() => this.slider?.unregisterThumb(this));

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.slider) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.THUMB_OUTSIDE_SLIDER,
            'An [etSliderThumb] must be placed inside an [etSlider] or [etRangeSlider].',
          );
        }
      });
    }
  }

  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  protected handleBlur() {
    this.focused.set(false);
    this.slider?.markTouched();
  }

  protected handleKeydown(event: KeyboardEvent) {
    const slider = this.slider;

    if (!slider || !slider.interactive() || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const step = slider.step();
    const index = this.index();
    const value = this.value();
    // direction-aware horizontal keys: ArrowRight always moves the thumb visually right
    const horizontalSign = getComputedStyle(this.elementRef.nativeElement).direction === 'rtl' ? -1 : 1;

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        slider.commitThumbValue(index, value + step * horizontalSign);

        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        slider.commitThumbValue(index, value - step * horizontalSign);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        slider.commitThumbValue(index, value + step);

        return;
      }
      case 'ArrowDown': {
        event.preventDefault();
        slider.commitThumbValue(index, value - step);

        return;
      }
      case 'PageUp': {
        event.preventDefault();
        slider.commitThumbValue(index, value + step * PAGE_STEP_MULTIPLIER);

        return;
      }
      case 'PageDown': {
        event.preventDefault();
        slider.commitThumbValue(index, value - step * PAGE_STEP_MULTIPLIER);

        return;
      }
      case 'Home': {
        event.preventDefault();
        slider.commitThumbValue(index, slider.effectiveMin());

        return;
      }
      case 'End': {
        event.preventDefault();
        slider.commitThumbValue(index, slider.effectiveMax());

        return;
      }
    }
  }
}
