import { DestroyRef, Directive, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { constrainRangeThumb, snapValueToStep, valueToPercent } from './internals/slider-engine';
import { SLIDER_TOKEN, SliderHostBase, SliderThumbBase, SliderThumbLabelBase } from './slider.tokens';

export type RangeSliderValue = [number, number];

@Directive({
  selector: '[etRangeSlider]',
  exportAs: 'etRangeSlider',
  providers: [{ provide: SLIDER_TOKEN, useExisting: RangeSliderDirective }],
})
export class RangeSliderDirective implements FormValueControl<RangeSliderValue>, FormFieldControl, SliderHostBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<RangeSliderValue>([0, 100]);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  // The signal-forms `FormValueControl` contract reserves `min`/`max` and types them as the
  // value shape (here the tuple), so the numeric track bounds need their own names.
  public minValue = input(0);
  public maxValue = input(100);
  public step = input(1);

  /** Minimum gap kept between the two thumbs — should be a multiple of `step`. */
  public minDistance = input(0);

  public effectiveMin = computed(() => this.minValue());
  public effectiveMax = computed(() => this.maxValue());

  public interactive = computed(() => !this.disabled() && !this.readonly());

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => true);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RANGE_SLIDER);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  public draggingThumbIndex = signal<number | null>(null);

  public thumbs = signal<readonly SliderThumbBase[]>([]);
  public registeredThumbLabelTemplate = signal<SliderThumbLabelBase | null>(null);

  public focused = computed(() => this.thumbs().some((thumb) => thumb.focused()));

  private bounds = computed(() => ({ min: this.effectiveMin(), max: this.effectiveMax(), step: this.step() }));

  public thumbValues = computed<readonly number[]>(() => {
    const bounds = this.bounds();
    const snapped = this.value().map((end) => snapValueToStep(end, bounds));

    return [Math.min(...snapped), Math.max(...snapped)];
  });

  public thumbPercents = computed<readonly number[]>(() =>
    this.thumbValues().map((value) => valueToPercent(value, this.bounds())),
  );

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    if (ngDevMode) {
      afterNextRender(() => {
        if (this.thumbs().length !== 2) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.THUMB_COUNT_MISMATCH,
            `[RangeSliderDirective] Expected exactly two [etSliderThumb] elements but found ${this.thumbs().length}. Place a start and an end thumb inside the range slider.`,
          );
        }
      });
    }
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.thumbs()[0]?.focus();
  }

  public thumbAriaBounds(index: number) {
    const [start, end] = this.thumbValues() as RangeSliderValue;

    return index === 0
      ? { min: this.effectiveMin(), max: end - this.minDistance() }
      : { min: start + this.minDistance(), max: this.effectiveMax() };
  }

  public commitThumbValue(index: number, value: number) {
    if (!this.interactive()) {
      return;
    }

    const current = this.thumbValues() as RangeSliderValue;
    const otherIndex = index === 0 ? 1 : 0;
    const constrained = constrainRangeThumb(snapValueToStep(value, this.bounds()), {
      end: index === 0 ? 'start' : 'end',
      otherValue: current[otherIndex],
      minDistance: this.minDistance(),
    });
    const snapped = snapValueToStep(constrained, this.bounds());

    if (snapped === current[index]) {
      return;
    }

    this.value.set(index === 0 ? [snapped, current[1]] : [current[0], snapped]);
  }

  public markTouched() {
    this.touched.set(true);
  }

  /** @internal */
  public registerThumb(thumb: SliderThumbBase) {
    this.thumbs.update((thumbs) => [...thumbs, thumb]);
  }

  /** @internal */
  public unregisterThumb(thumb: SliderThumbBase) {
    this.thumbs.update((thumbs) => thumbs.filter((registered) => registered !== thumb));
  }
}
