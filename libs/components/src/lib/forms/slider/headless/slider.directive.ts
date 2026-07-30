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
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { snapValueToStep, valueToPercent } from './internals/slider-engine';
import { SLIDER_TOKEN, SliderHostBase, SliderThumbBase, SliderThumbLabelBase } from './slider.tokens';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';

@Directive({
  selector: '[etSlider]',
  exportAs: 'etSlider',
  providers: [{ provide: SLIDER_TOKEN, useExisting: SliderDirective }],
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class SliderDirective implements FormValueControl<number>, FormFieldControl, SliderHostBase {
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model(0);
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  /** `aria-valuetext` the thumb announces while `mixed` is set. */
  public mixedLabel = input<string | null>(null);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  // `min`/`max` satisfy the signal-forms `FormValueControl` contract (`NonNullable<TValue> | undefined`),
  // so schema `min(...)` / `max(...)` validators bind straight into these inputs.
  public min = input<number | undefined>(undefined);
  public max = input<number | undefined>(undefined);
  public step = input(1, { transform: numberAttribute });

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public effectiveMin = computed(() => this.min() ?? 0);
  public effectiveMax = computed(() => this.max() ?? 100);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => true);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SLIDER);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  public draggingThumbIndex = signal<number | null>(null);

  public thumbs = signal<readonly SliderThumbBase[]>([]);
  public registeredThumbLabelTemplate = signal<SliderThumbLabelBase | null>(null);

  public hasCustomAccessibleName = computed(() => this.thumbs().some((thumb) => !!thumb.label().trim()));

  public focused = computed(() => this.thumbs().some((thumb) => thumb.focused()));

  private bounds = computed(() => ({ min: this.effectiveMin(), max: this.effectiveMax(), step: this.step() }));

  // while mixed, the thumb parks at the track start so the DOM (position, ARIA) exposes
  // nothing of the hidden raw value — the keyboard model then also steps from the minimum
  public thumbValues = computed<readonly number[]>(() =>
    this.mixed() ? [this.effectiveMin()] : [snapValueToStep(this.value(), this.bounds())],
  );

  public thumbPercents = computed<readonly number[]>(() =>
    this.thumbValues().map((value) => valueToPercent(value, this.bounds())),
  );

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    if (ngDevMode) {
      afterNextRender(() => {
        if (this.thumbs().length !== 1) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.THUMB_COUNT_MISMATCH,
            `[SliderDirective] Expected exactly one [etSliderThumb] but found ${this.thumbs().length}. Place a single thumb element inside the slider (use [etRangeSlider] for two thumbs).`,
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

  public thumbAriaBounds() {
    return { min: this.effectiveMin(), max: this.effectiveMax() };
  }

  public commitThumbValue(index: number, value: number) {
    // the single slider has one thumb — `index` only exists to satisfy the shared host contract
    void index;

    if (!this.interactive()) {
      return;
    }

    const snapped = snapValueToStep(value, this.bounds());

    // only user interactions route through here — the first commit resolves mixed even
    // when the chosen value happens to equal the hidden raw one (replace semantics)
    this.mixed.set(false);

    if (snapped !== this.value()) {
      this.value.set(snapped);
    }
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
