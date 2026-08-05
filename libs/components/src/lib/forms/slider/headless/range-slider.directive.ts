import {
  DestroyRef,
  Directive,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  numberAttribute,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import {
  adjacentMarkValue,
  constrainRangeThumb,
  resolveMarks,
  snapValueToMarks,
  snapValueToStep,
  toMarkStops,
  valueToPercent,
} from './internals/slider-engine';
import {
  SLIDER_TOKEN,
  SliderHostBase,
  SliderMarks,
  SliderOrientation,
  SliderThumbBase,
  SliderThumbLabelBase,
} from './slider.tokens';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';

export type RangeSliderValue = [number, number];

@Directive({
  selector: '[etRangeSlider]',
  exportAs: 'etRangeSlider',
  providers: [{ provide: SLIDER_TOKEN, useExisting: RangeSliderDirective }],
  host: {
    '[attr.data-mixed]': 'mixed() || null',
    '[attr.data-orientation]': 'orientation()',
  },
})
export class RangeSliderDirective implements FormValueControl<RangeSliderValue>, FormFieldControl, SliderHostBase {
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private readonly hostElement = injectHostElement();

  public value = model<RangeSliderValue>([0, 100]);
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  /** `aria-valuetext` both thumbs announce while `mixed` is set. */
  public mixedLabel = input<string | null>(null);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  // The signal-forms `FormValueControl` contract reserves `min`/`max` and types them as the
  // value shape (here the tuple), so the numeric track bounds need their own names.
  public minValue = input(0, { transform: numberAttribute });
  public maxValue = input(100, { transform: numberAttribute });
  public step = input(1, { transform: numberAttribute });

  /** Minimum gap kept between the two thumbs - should be a multiple of `step`. */
  public minDistance = input(0, { transform: numberAttribute });

  /** Axis the slider runs along. A vertical slider runs bottom→up and is not mirrored in RTL. */
  public orientation = input<SliderOrientation>('horizontal');

  /** Tick stops: `true` for one per `step`, or an explicit list of (optionally labelled) values. */
  public marks = input<SliderMarks>(false);

  /** Snaps commits onto the marks instead of the `step` grid. No effect without `marks`. */
  public snapToMarks = input(false, { transform: booleanAttribute });

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

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

  public hasCustomAccessibleName = computed(() => this.thumbs().some((thumb) => !!thumb.label().trim()));

  private bounds = computed(() => ({ min: this.effectiveMin(), max: this.effectiveMax(), step: this.step() }));

  private resolvedMarks = computed(() => resolveMarks(this.marks(), this.bounds()));

  /** The mark grid commits snap to, or empty when `snapToMarks` is off. */
  private snapMarkValues = computed(() => (this.snapToMarks() ? this.resolvedMarks().map((mark) => mark.value) : []));

  // while mixed, both thumbs park at the track start so the DOM (positions, ARIA) exposes
  // nothing of the hidden raw range - the keyboard model then also steps from the minimum
  public thumbValues = computed<readonly number[]>(() => {
    if (this.mixed()) {
      const min = this.effectiveMin();

      return [min, min];
    }

    const snapped = this.value().map((end) => this.snapValue(end));

    return [Math.min(...snapped), Math.max(...snapped)];
  });

  public thumbPercents = computed<readonly number[]>(() =>
    this.thumbValues().map((value) => valueToPercent(value, this.bounds())),
  );

  public markStops = computed(() => {
    const [start, end] = this.thumbValues();

    return toMarkStops(this.resolvedMarks(), {
      bounds: this.bounds(),
      // parked thumbs fill nothing - no tick may read as active while mixed
      activeRange: this.mixed() || start === undefined || end === undefined ? null : [start, end],
    });
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    if (ngDevMode) {
      afterNextRender(() => {
        if (this.thumbs().length !== 2) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.THUMB_COUNT_MISMATCH,
            `[RangeSliderDirective] Expected exactly two [etSliderThumb] elements but found ${this.thumbs().length}. Place a start and an end thumb inside the range slider.`,
            { element: this.hostElement },
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
    // parked thumbs carry no sibling constraint - while mixed, both announce the full track
    if (this.mixed()) {
      return { min: this.effectiveMin(), max: this.effectiveMax() };
    }

    const [start, end] = this.thumbValues() as RangeSliderValue;

    return index === 0
      ? { min: this.effectiveMin(), max: end - this.minDistance() }
      : { min: start + this.minDistance(), max: this.effectiveMax() };
  }

  public thumbValueText(index: number) {
    if (this.mixed()) {
      return this.resolvedMixedLabel();
    }

    // only a mark-snapped slider can be sure the thumb sits on a labelled stop
    if (!this.snapToMarks()) {
      return null;
    }

    const value = this.thumbValues()[index];

    return this.resolvedMarks().find((mark) => mark.value === value)?.label ?? null;
  }

  public adjacentValue(value: number, steps: number) {
    const markValues = this.snapMarkValues();

    return markValues.length ? adjacentMarkValue(value, { markValues, steps }) : value + steps * this.step();
  }

  public commitThumbValue(index: number, value: number) {
    if (!this.interactive()) {
      return;
    }

    // only user interactions route through here - the first committed thumb resolves mixed
    // by writing a fresh range: the chosen value on its end, the default bound on the other
    if (this.mixed()) {
      const otherBound = index === 0 ? this.effectiveMax() : this.effectiveMin();
      const snapped = this.constrainAndSnap(value, { index, otherValue: otherBound });

      this.mixed.set(false);
      this.value.set(index === 0 ? [snapped, otherBound] : [otherBound, snapped]);

      return;
    }

    const current = this.thumbValues() as RangeSliderValue;
    const snapped = this.constrainAndSnap(value, { index, otherValue: current[index === 0 ? 1 : 0] });

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

  private snapValue(value: number) {
    const markValues = this.snapMarkValues();

    return markValues.length ? snapValueToMarks(value, { markValues }) : snapValueToStep(value, this.bounds());
  }

  /**
   * Snaps `value`, keeps it clear of the sibling, then snaps again - the sibling limit itself
   * need not sit on the grid, so the second snap moves away from the sibling, never across it.
   */
  private constrainAndSnap(value: number, thumb: { index: number; otherValue: number }) {
    const end = thumb.index === 0 ? 'start' : 'end';
    const constrained = constrainRangeThumb(this.snapValue(value), {
      end,
      otherValue: thumb.otherValue,
      minDistance: this.minDistance(),
    });
    const markValues = this.snapMarkValues();

    return markValues.length
      ? snapValueToMarks(constrained, { markValues, direction: end === 'start' ? 'down' : 'up' })
      : snapValueToStep(constrained, this.bounds());
  }
}
