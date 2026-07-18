import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { INPUT_TEXT_ALIGNMENTS, InputTextAlignment } from '../input.types';

@Directive({
  selector: '[etNumberInput]',
})
export class NumberInputDirective implements FormValueControl<number | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<number | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  // `min`/`max` satisfy the signal-forms `FormValueControl` contract, which types them as
  // `NonNullable<TValue> | undefined` — so they must be `number | undefined`, not `number | null`.
  public min = input<number | undefined>(undefined);
  public max = input<number | undefined>(undefined);
  public step = input<number | null>(null);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value() !== null);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.NUMBER_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  /**
   * The native input element this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it.
   */
  public nativeControl = signal<HTMLInputElement | null>(null);

  /** Whether stepping up would change the value — `false` at the `max` bound or while non-interactive. */
  public canStepUp = computed(() => {
    if (this.disabled() || this.readonly()) return false;

    const max = this.max();

    return max === undefined || (this.value() ?? 0) < max;
  });

  /** Whether stepping down would change the value — `false` at the `min` bound or while non-interactive. */
  public canStepDown = computed(() => {
    if (this.disabled() || this.readonly()) return false;

    const min = this.min();

    return min === undefined || (this.value() ?? 0) > min;
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'INPUT') {
      this.nativeControl.set(hostElement as HTMLInputElement);
      this.focusTarget.set(hostElement);
    }
  }

  public activate() {
    if (this.disabled()) return;

    this.focusTarget()?.focus();
  }

  /** Steps the value by `step` (an empty value starts from `0`), clamped to `min`/`max`. */
  public stepBy(direction: 1 | -1) {
    if (this.disabled() || this.readonly()) return;

    const step = this.step() ?? 1;
    const current = this.value() ?? 0;
    const precision = Math.max(decimalPrecisionOf(step), decimalPrecisionOf(current));
    let next = Number((current + step * direction).toFixed(precision));

    const min = this.min();
    const max = this.max();

    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);

    if (next !== this.value()) {
      this.value.set(next);
      // stepping is a deliberate edit — mark touched so validation errors surface immediately,
      // rather than staying hidden until a separate blur (typed entry already touches on blur)
      this.touched.set(true);
    }
  }

  /** @internal */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    const parsed = inputElement.valueAsNumber;

    this.value.set(Number.isNaN(parsed) ? null : parsed);
  }
}

/** Decimal places needed to represent `value` exactly — strips float noise from step math. */
const decimalPrecisionOf = (value: number) => {
  const text = value.toString();

  if (text.includes('e-')) {
    return Number(text.split('e-')[1]);
  }

  const fraction = text.split('.')[1];

  return fraction ? fraction.length : 0;
};
