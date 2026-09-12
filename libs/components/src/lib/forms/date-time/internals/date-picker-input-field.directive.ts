import { Directive, ElementRef, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { InputMaskHost } from '../../masked-input/headless/input-mask-host';
import { DatePickerInputDirective } from './date-picker-input.directive';

/**
 * Shared text-field host for the three `Date`-string picker inputs' fields
 * (`input[etDateInputField]`, `input[etTimeInputField]`, `input[etDateTimeInputField]`).
 *
 * Must be extended by an `@Directive` - subclasses inject their input directive into `pickerInput`,
 * register themselves as the field, and provide `INPUT_MASK_HOST` via `useExisting`.
 */
@Directive({
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.inputmode]': 'maskAttached() ? "numeric" : null',
    '[attr.placeholder]': 'pickerInput?.effectivePlaceholder() || null',
    '[attr.aria-required]': 'pickerInput?.required() || null',
    '[attr.aria-invalid]': 'pickerInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'pickerInput?.describedByIds() || null',
    '[attr.aria-label]': 'pickerInput?.ariaLabel() || null',
    '[attr.aria-labelledby]': 'pickerInput?.labelId() || null',
    // attr bindings, not [disabled]/[readOnly]: this base has no selector, so the template
    // checker can't tie the host to an <input> and rejects the property forms (NG8002)
    '[attr.disabled]': 'pickerInput?.disabled() ? "" : null',
    '[attr.readonly]': 'pickerInput?.readonly() ? "" : null',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export abstract class DatePickerInputFieldDirective implements InputMaskHost {
  protected abstract pickerInput: DatePickerInputDirective | null;

  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  /** Set while an `[etInputMask]` owns this field's element text and value-sync. */
  protected maskAttached = signal(false);

  /**
   * The field text as an attached mask sees it (`InputMaskHost.value`):
   * display-shaped, never containing guide placeholders.
   */
  public value = linkedSignal(() => {
    const input = this.pickerInput;

    if (!input) {
      return '';
    }

    return input.parseError() ? input.inputText() : input.displayValue();
  });

  /** Whether the field has focus (`InputMaskHost.focused`) - drives the mask's guide display. */
  public focused = computed(() => this.pickerInput?.focused() ?? false);

  /** The native element an attached mask rewrites (`InputMaskHost.nativeControl`). */
  public nativeControl = signal<HTMLInputElement | null>(null);

  constructor() {
    this.nativeControl.set(this.elementRef.nativeElement);

    // mid-typing rewrites would fight the caret, so the element only mirrors while unfocused; an
    // attached mask owns the element text instead
    effect(() => {
      const input = this.pickerInput;

      if (!input || this.maskAttached()) {
        return;
      }

      const text = input.parseError() ? input.inputText() : input.displayValue();

      if (!input.focused() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    // masked typing bypasses handleInput, so mirror the mask-written text into `inputText`
    effect(() => {
      if (!this.maskAttached()) {
        return;
      }

      const text = this.value();
      const input = this.pickerInput;

      if (input && untracked(input.focused)) {
        untracked(() => input.inputText.set(text));
      }
    });
  }

  /** @internal */
  public focus(options?: FocusOptions) {
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  /**
   * @internal Blanks the field text. `value` is what an attached mask reads and what
   * `commitText()` hands to the next commit, so blanking the element alone would let the mask's
   * text come back on the next blur.
   */
  public resetText() {
    this.value.set('');
    this.elementRef.nativeElement.value = '';
  }

  /** @internal `InputMaskHost` - an attached mask owns value-sync; our input/mirror handling stands down. */
  public suppressNativeSync() {
    this.maskAttached.set(true);
  }

  /** @internal `InputMaskHost` - the mask was set to `null`; native handling resumes. */
  public resumeNativeSync() {
    this.maskAttached.set(false);
  }

  protected handleInput() {
    if (this.maskAttached()) {
      return;
    }

    this.pickerInput?.inputText.set(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.pickerInput?.focused.set(true);
  }

  protected handleBlur() {
    const input = this.pickerInput;

    if (!input) {
      return;
    }

    input.commitInput(this.commitText());
    input.focused.set(false);
    input.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const input = this.pickerInput;

    if (!input) {
      return;
    }

    if (event.key === 'Enter') {
      input.commitInput(this.commitText());

      // the display effect only runs unfocused, so a successful commit reformats in place here
      if (!input.parseError() && !this.maskAttached()) {
        this.elementRef.nativeElement.value = input.displayValue();
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      input.openPicker();
    }
  }

  private commitText() {
    return this.maskAttached() ? this.value() : this.elementRef.nativeElement.value;
  }
}
