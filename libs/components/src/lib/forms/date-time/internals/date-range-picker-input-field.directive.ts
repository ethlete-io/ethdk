import {
  DestroyRef,
  Directive,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { InputMaskHost } from '../../masked-input/headless/input-mask-host';
import { DateRangePickerInputDirective, DateRangeSide } from './date-range-picker-input.directive';

/**
 * Shared text field for the range picker inputs' two sides (`input[etDateRangeInputField]`,
 * `input[etDateTimeRangeInputField]`): shows the committed side value in the display format, commits
 * typed text on blur/Enter, keeps unparseable text visible, and opens the picker on Alt+ArrowDown.
 * Each side is its own `INPUT_MASK_HOST`, so a typing mask's guide only shows on the focused one.
 *
 * Must be extended by an `@Directive` - subclasses inject their range directive into `rangeInput` and
 * provide `INPUT_MASK_HOST` via `useExisting`.
 */
@Directive({
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.inputmode]': 'maskAttached() ? "numeric" : null',
    '[attr.placeholder]': 'placeholder() || null',
    '[attr.aria-required]': 'rangeInput?.required() || null',
    '[attr.aria-invalid]': 'rangeInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'rangeInput?.describedByIds() || null',
    // attr bindings, not [disabled]/[readOnly]: this base has no selector, so the template
    // checker can't tie the host to an <input> and rejects the property forms (NG8002)
    '[attr.disabled]': 'rangeInput?.disabled() ? "" : null',
    '[attr.readonly]': 'rangeInput?.readonly() ? "" : null',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export abstract class DateRangePickerInputFieldDirective implements InputMaskHost {
  protected abstract rangeInput: DateRangePickerInputDirective | null;
  protected abstract duplicateFieldError(side: DateRangeSide): RuntimeError<number>;

  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private destroyRef = inject(DestroyRef);

  /** Which end of the range this field edits. */
  public side = input.required<DateRangeSide>();

  /** Set while an `[etInputMask]` owns this field's element text and value-sync. */
  protected maskAttached = signal(false);

  /**
   * This side's field text as an attached mask sees it (`InputMaskHost.value`):
   * display-shaped, never containing guide placeholders. Mask edits write it while
   * typing; every commit resets it to the committed display text (or the kept
   * unparseable text), which also carries the committed value into a focus.
   */
  public value = linkedSignal(() => {
    const rangeInput = this.rangeInput;

    if (!rangeInput) {
      return '';
    }

    return this.mirrorText(rangeInput);
  });

  /** Whether this side's field has focus (`InputMaskHost.focused`) - drives the mask's guide display. */
  public focused = computed(() => this.rangeInput?.focusedSide() === this.side());

  /** The native element an attached mask rewrites (`InputMaskHost.nativeControl`). */
  public nativeControl = signal<HTMLInputElement | null>(null);

  constructor() {
    this.nativeControl.set(this.elementRef.nativeElement);

    // the side input is not available at construction time - register reactively
    effect((onCleanup) => {
      const rangeInput = this.rangeInput;

      if (!rangeInput) {
        return;
      }

      const side = this.side();

      rangeInput.registerField({ side, field: this, duplicateFieldError: () => this.duplicateFieldError(side) });
      onCleanup(() => rangeInput.unregisterField(side, this));
    });

    // while unfocused the element mirrors the committed side value (or the kept
    // unparseable text); mid-typing rewrites would fight the caret. An attached
    // mask owns the element text instead and renders the same mirror itself
    effect(() => {
      const rangeInput = this.rangeInput;

      if (!rangeInput || this.maskAttached()) {
        return;
      }

      const text = this.mirrorText(rangeInput);

      if (rangeInput.focusedSide() !== this.side() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    // masked typing bypasses handleInput, so mirror the mask-written text into
    // the side's inputText - hasValue (and the clear affordance) must react like
    // native typing
    effect(() => {
      if (!this.maskAttached()) {
        return;
      }

      const text = this.value();
      const rangeInput = this.rangeInput;
      const side = this.side();

      if (rangeInput && untracked(() => rangeInput.focusedSide()) === side) {
        untracked(() => rangeInput.setInputText(side, text));
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.rangeInput?.focusedSide() === this.side()) {
        this.rangeInput.focusedSide.set(null);
      }
    });
  }

  /** @internal */
  public focus(options?: FocusOptions) {
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  /**
   * @internal Blanks this side's field text. `value` is what an attached mask reads and what
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

  protected placeholder() {
    const rangeInput = this.rangeInput;

    if (!rangeInput) {
      return '';
    }

    // while mixed both fields render empty and the mixed label shows through the placeholder
    if (rangeInput.mixed()) {
      return rangeInput.resolvedMixedLabel();
    }

    return this.side() === 'start' ? rangeInput.startPlaceholder() : rangeInput.endPlaceholder();
  }

  protected handleInput() {
    // the mask reconciles the edit and writes `value` (and thereby `inputText`) itself
    if (this.maskAttached()) {
      return;
    }

    this.rangeInput?.setInputText(this.side(), this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.rangeInput?.focusedSide.set(this.side());
  }

  protected handleBlur() {
    const rangeInput = this.rangeInput;

    if (!rangeInput) {
      return;
    }

    rangeInput.commitSide(this.side(), this.commitText());

    if (rangeInput.focusedSide() === this.side()) {
      rangeInput.focusedSide.set(null);
    }

    rangeInput.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const rangeInput = this.rangeInput;

    if (!rangeInput) {
      return;
    }

    if (event.key === 'Enter') {
      rangeInput.commitSide(this.side(), this.commitText());

      // a successful commit reformats in place (the display effect only runs
      // unfocused); a mask re-renders the element from the reset `value` instead
      if (!rangeInput.sideParseError(this.side()) && !this.maskAttached()) {
        this.elementRef.nativeElement.value = rangeInput.displayValue(this.side());
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      rangeInput.openPicker();
    }
  }

  /** The committed display text, or the unparseable text this side is holding on to. */
  private mirrorText(rangeInput: DateRangePickerInputDirective) {
    const side = this.side();

    return rangeInput.sideParseError(side) ? rangeInput.inputText(side) : rangeInput.displayValue(side);
  }

  /** What a blur/Enter commit parses - the mask's value, since the element text may hold guide placeholders. */
  private commitText() {
    return this.maskAttached() ? this.value() : this.elementRef.nativeElement.value;
  }
}
