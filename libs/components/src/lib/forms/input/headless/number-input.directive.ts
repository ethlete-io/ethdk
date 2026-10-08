import { computed, Directive, ElementRef, inject, input, linkedSignal, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import { injectInputLabels } from '../input-labels';
import { INPUT_TEXT_ALIGNMENTS, InputTextAlignment } from '../input.types';
import { nullableNumberAttribute, optionalNumberAttribute } from '../../../internals/number-attributes';

/** How one `stepBy` call departs from a plain single `step`. */
export type NumberInputStepOptions = {
  /** Multiplies `step` for this call - `10` for the coarse modifier, `0.1` for the fine one. */
  multiplier?: number;
  /**
   * Whether the step marks the control touched. A drag-to-scrub passes `false` and marks touched
   * once the gesture ends, so scrubbing past a bound does not flash a validation error mid-drag.
   */
  markTouched?: boolean;
};

/**
 * The step multiplier a modifier-carrying event asks for: `Shift` steps 10x, `Alt`/`Option` steps
 * a tenth, and no modifier steps a plain `step`.
 *
 * `Ctrl`/`Cmd` is deliberately unused - it is a browser-zoom shortcut on several platforms.
 */
export const numberInputStepMultiplierFrom = (event: { shiftKey: boolean; altKey: boolean }) => {
  if (event.shiftKey) return 10;
  if (event.altKey) return 0.1;

  return 1;
};

const PAGE_STEP_MULTIPLIER = 100;

@Directive({
  selector: '[etNumberInput]',
  host: {
    '(keydown)': 'handleStepKeydown($event)',
    '(beforeinput)': 'handleBeforeInput($event)',
    '(input)': 'handleNativeInput($event)',
    '(focus)': 'handleNativeFocus($event)',
    '(blur)': 'handleNativeBlur($event)',
  },
})
export class NumberInputDirective extends TextFieldControlDirective implements FormValueControl<number | null> {
  private inputLabels = injectInputLabels();

  public value = model<number | null>(null);

  // `min`/`max` satisfy the signal-forms `FormValueControl` contract, which types them as
  // `NonNullable<TValue> | undefined` - so they must be `number | undefined`, not `number | null`.
  public min = input(undefined, { transform: optionalNumberAttribute });
  public max = input(undefined, { transform: optionalNumberAttribute });
  public step = input(null, { transform: nullableNumberAttribute });
  /**
   * The most fraction digits the user can type - `0` takes whole numbers only. Stepping rounds to it
   * too. `null` leaves typing unrestricted. A value written by code is never rounded.
   */
  public decimals = input(null, { transform: nullableNumberAttribute });
  /** Message the form field shows when the typed text is not a number. */
  public parseErrorMessage = input<string | null>(null);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  public hasValue = computed(() => this.mixed() || this.value() !== null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.NUMBER_INPUT);

  /** `true` while the native input holds text the browser cannot read as a number (`-`, `-.`). */
  public parseError = linkedSignal({ source: this.value, computation: () => false });

  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.inputLabels().invalidNumber);

  public override shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  /** The virtual keyboard the native input asks for - digits only while `decimals` is `0`. */
  public inputMode = computed(() => {
    const decimals = this.decimals();

    if (decimals === null) return null;

    return decimals > 0 ? 'decimal' : 'numeric';
  });

  /** What the native input renders - empty while mixed so the raw value never reaches the DOM. */
  public displayValue = computed(() => (this.mixed() ? '' : (this.value() ?? '')));

  /** The placeholder the native input renders - `mixedLabel` overrides the consumer placeholder while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  /**
   * The native input element this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it.
   */
  public nativeControl = signal<HTMLInputElement | null>(null);

  private textBeforeEdit: string | null = null;

  /** The value stepping starts from - `0` while mixed (deriving from the hidden raw value would leak it). */
  private steppingBase = computed(() => (this.mixed() ? 0 : (this.value() ?? 0)));

  /** Whether stepping up would change the value - `false` at the `max` bound or while non-interactive. */
  public canStepUp = computed(() => {
    if (this.disabled() || this.readonly()) return false;

    const max = this.max();

    return max === undefined || this.steppingBase() < max;
  });

  /** Whether stepping down would change the value - `false` at the `min` bound or while non-interactive. */
  public canStepDown = computed(() => {
    if (this.disabled() || this.readonly()) return false;

    const min = this.min();

    return min === undefined || this.steppingBase() > min;
  });

  constructor() {
    super();

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'INPUT') {
      this.nativeControl.set(hostElement as HTMLInputElement);
      this.focusTarget.set(hostElement);
      this.mirrorOntoNativeHost(hostElement as HTMLInputElement, {
        value: () => `${this.displayValue()}`,
        placeholder: this.effectivePlaceholder,
        attributes: () => ({
          min: this.min()?.toString() ?? null,
          max: this.max()?.toString() ?? null,
          step: this.step()?.toString() ?? null,
          inputmode: this.inputMode(),
        }),
      });
    }
  }

  /**
   * Steps the value by `step` (an empty or mixed value starts from `0`), clamped to `min`/`max`.
   *
   * Pass `multiplier` to step a coarser or finer amount than one `step` - a keyboard modifier, or
   * the whole distance a scrub covered since the last move.
   */
  public stepBy(direction: 1 | -1, options?: NumberInputStepOptions) {
    if (this.disabled() || this.readonly()) return;

    const multiplier = withoutFloatNoise(options?.multiplier ?? 1);
    const markTouched = options?.markTouched ?? true;
    const step = this.step() ?? 1;
    const current = this.steppingBase();
    // the multiplier's own decimals count: a 0.1x step of a 0.1 step is 0.01, and reading the
    // precision off the multiplied step would read float noise (0.1 * 0.1) as 18 decimals
    const precision = Math.max(decimalPrecisionOf(step) + decimalPrecisionOf(multiplier), decimalPrecisionOf(current));
    let next = Number((current + step * multiplier * direction).toFixed(precision));
    const decimals = this.decimals();

    if (decimals !== null) next = Number(next.toFixed(decimals));

    const min = this.min();
    const max = this.max();

    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);

    if (this.mixed()) {
      // stepping is a user commit - it replaces the hidden raw value and resolves mixed
      this.mixed.set(false);
      this.value.set(next);
      if (markTouched) this.touched.set(true);

      return;
    }

    if (next !== this.value()) {
      this.value.set(next);
      if (markTouched) this.touched.set(true);
    }
  }

  /**
   * @internal Arrow and page keys step through {@link stepBy} rather than through the native
   * input's own stepping, so every route into the value shares the mixed handling, the clamping
   * and the `touched` marking - and so a modifier can change the magnitude.
   */
  public handleStepKeydown(event: KeyboardEvent) {
    if (event.target !== this.nativeControl() || event.ctrlKey || event.metaKey) return;

    const direction = STEP_KEY_DIRECTIONS[event.key];

    if (!direction) return;

    const isPageKey = event.key === 'PageUp' || event.key === 'PageDown';
    const multiplier = isPageKey ? PAGE_STEP_MULTIPLIER : numberInputStepMultiplierFrom(event);

    // the browser steps a native number input on the arrow keys by itself - without this its
    // plain step lands on top of the multiplied one
    event.preventDefault();
    this.stepBy(direction, { multiplier });
  }

  /**
   * Rejects an edit that inserts a character the control never takes: exponent notation always,
   * and the decimal separators while `decimals` is `0`. A paste or drop holding one is rejected whole.
   */
  protected handleBeforeInput(event: InputEvent) {
    const inputElement = this.nativeControl();

    if (event.target !== inputElement) return;

    const inserted = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
    const forbidden = this.decimals() === 0 ? WHOLE_NUMBER_FORBIDDEN_CHARACTERS : FORBIDDEN_CHARACTERS;

    if (forbidden.test(inserted)) {
      event.preventDefault();

      return;
    }

    this.textBeforeEdit = inputElement.value;
  }

  /** @internal Keeps the model in sync while typing into a standalone native host. */
  protected handleNativeInput(event: Event) {
    const inputElement = this.nativeControl();

    if (event.target !== inputElement) return;

    const textBeforeEdit = this.textBeforeEdit ?? `${this.displayValue()}`;

    this.textBeforeEdit = null;

    // `selectionStart` is null on `type="number"`, so `beforeinput` cannot tell where the text
    // lands - the excess is only visible here, after the browser applied it
    if (this.exceedsDecimals(inputElement.value)) {
      inputElement.value = textBeforeEdit;

      return;
    }

    this.syncFromNativeInput(inputElement);
  }

  /**
   * @internal Routes a user edit from the native input into the model. Typing is the commit
   * over a mixed state: the first edit that produces content replaces the raw value and
   * resolves `mixed`; an edit that leaves the input empty keeps both untouched.
   */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    if (this.mixed()) {
      if (!inputElement.value) {
        return;
      }

      this.mixed.set(false);
    }

    const parsed = inputElement.valueAsNumber;

    this.value.set(Number.isNaN(parsed) ? null : parsed);
    this.parseError.set(inputElement.validity.badInput);
  }

  private exceedsDecimals(text: string) {
    const decimals = this.decimals();

    if (decimals === null) return false;

    const fraction = text.split(DECIMAL_SEPARATOR)[1] ?? '';

    return fraction.length > decimals;
  }
}

const FORBIDDEN_CHARACTERS = /[eE+]/;
const WHOLE_NUMBER_FORBIDDEN_CHARACTERS = /[eE+.,]/;
const DECIMAL_SEPARATOR = /[.,]/;

const STEP_KEY_DIRECTIONS: Record<string, 1 | -1 | undefined> = {
  ArrowUp: 1,
  ArrowDown: -1,
  PageUp: 1,
  PageDown: -1,
};

const withoutFloatNoise = (value: number) => Number(value.toPrecision(12));

/** Decimal places needed to represent `value` exactly - strips float noise from step math. */
const decimalPrecisionOf = (value: number) => {
  const text = value.toString();

  if (text.includes('e-')) {
    return Number(text.split('e-')[1]);
  }

  const fraction = text.split('.')[1];

  return fraction ? fraction.length : 0;
};
