import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { INPUT_MASK_HOST, InputMaskHost } from '../../../masked-input/headless/input-mask-host';
import { DATE_RANGE_INPUT_ERROR_CODES } from '../date-range-input-errors';
import { DateRangeInputDirective, DateRangeSide } from './date-range-input.directive';

/**
 * One side of a date range input: shows the committed side value in the
 * display format, commits typed text strictly on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown. Hosts the
 * range input's opt-in typing mask (`INPUT_MASK_HOST`) - each side is its own
 * mask host.
 */
@Directive({
  selector: 'input[etDateRangeInputField]',
  exportAs: 'etDateRangeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: DateRangeInputFieldDirective }],
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.inputmode]': 'maskAttached() ? "numeric" : null',
    '[attr.placeholder]': 'placeholder() || null',
    '[attr.aria-required]': 'rangeInput?.required() || null',
    '[attr.aria-invalid]': 'rangeInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'rangeInput?.describedBy() || null',
    '[disabled]': 'rangeInput?.disabled() || false',
    '[readOnly]': 'rangeInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class DateRangeInputFieldDirective implements InputMaskHost {
  protected rangeInput = inject(DateRangeInputDirective, { optional: true });
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

    const side = this.side();

    return rangeInput.sideParseError(side) ? rangeInput.inputText(side) : rangeInput.displayValue(side);
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

      rangeInput.registerField(side, this);
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

      const side = this.side();
      const text = rangeInput.sideParseError(side) ? rangeInput.inputText(side) : rangeInput.displayValue(side);

      if (rangeInput.focusedSide() !== side && this.elementRef.nativeElement.value !== text) {
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

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.rangeInput) {
          throw new RuntimeError(
            DATE_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_RANGE_INPUT,
            '[DateRangeInputFieldDirective] etDateRangeInputField must be placed inside an [etDateRangeInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected placeholder() {
    if (!this.rangeInput) {
      return '';
    }

    // while mixed both fields render empty and the mixed label shows through the placeholder
    if (this.rangeInput.mixed()) {
      return this.rangeInput.resolvedMixedLabel();
    }

    return this.side() === 'start' ? this.rangeInput.startPlaceholder() : this.rangeInput.endPlaceholder();
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
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

  /** What a blur/Enter commit parses - the mask's value, since the element text may hold guide placeholders. */
  private commitText() {
    return this.maskAttached() ? this.value() : this.elementRef.nativeElement.value;
  }
}
