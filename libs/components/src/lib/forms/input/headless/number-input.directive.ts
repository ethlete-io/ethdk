import { computed, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import { INPUT_TEXT_ALIGNMENTS, InputTextAlignment } from '../input.types';

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
  },
})
export class NumberInputDirective extends TextFieldControlDirective implements FormValueControl<number | null> {
  public value = model<number | null>(null);

  // `min`/`max` satisfy the signal-forms `FormValueControl` contract, which types them as
  // `NonNullable<TValue> | undefined` - so they must be `number | undefined`, not `number | null`.
  public min = input<number | undefined>(undefined);
  public max = input<number | undefined>(undefined);
  public step = input<number | null>(null);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  public hasValue = computed(() => this.mixed() || this.value() !== null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.NUMBER_INPUT);

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

    const multiplier = options?.multiplier ?? 1;
    const markTouched = options?.markTouched ?? true;
    const step = this.step() ?? 1;
    const current = this.steppingBase();
    // the multiplier's own decimals count: a 0.1x step of a 0.1 step is 0.01, and reading the
    // precision off the multiplied step would read float noise (0.1 * 0.1) as 18 decimals
    const precision = Math.max(decimalPrecisionOf(step) + decimalPrecisionOf(multiplier), decimalPrecisionOf(current));
    let next = Number((current + step * multiplier * direction).toFixed(precision));

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
      // stepping is a deliberate edit - mark touched so validation errors surface immediately,
      // rather than staying hidden until a separate blur (typed entry already touches on blur)
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
  }
}

const STEP_KEY_DIRECTIONS: Record<string, 1 | -1 | undefined> = {
  ArrowUp: 1,
  ArrowDown: -1,
  PageUp: 1,
  PageDown: -1,
};

/** Decimal places needed to represent `value` exactly - strips float noise from step math. */
const decimalPrecisionOf = (value: number) => {
  const text = value.toString();

  if (text.includes('e-')) {
    return Number(text.split('e-')[1]);
  }

  const fraction = text.split('.')[1];

  return fraction ? fraction.length : 0;
};
