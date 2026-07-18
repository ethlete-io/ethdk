import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { DATE_RANGE_INPUT_ERROR_CODES } from '../date-range-input-errors';
import { DateRangeInputDirective, DateRangeSide } from './date-range-input.directive';

/**
 * One side of a date range input: shows the committed side value in the
 * display format, commits typed text strictly on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown.
 */
@Directive({
  selector: 'input[etDateRangeInputField]',
  exportAs: 'etDateRangeInputField',
  host: {
    type: 'text',
    autocomplete: 'off',
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
export class DateRangeInputFieldDirective {
  protected rangeInput = inject(DateRangeInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** Which end of the range this field edits. */
  public side = input.required<DateRangeSide>();

  constructor() {
    // the side input is not available at construction time — register reactively
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
    // unparseable text); mid-typing rewrites would fight the caret
    effect(() => {
      const rangeInput = this.rangeInput;

      if (!rangeInput) {
        return;
      }

      const side = this.side();
      const text = rangeInput.sideParseError(side) ? rangeInput.inputText(side) : rangeInput.displayValue(side);

      if (rangeInput.focusedSide() !== side && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
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
          );
        }
      });
    }
  }

  protected placeholder() {
    if (!this.rangeInput) {
      return '';
    }

    return this.side() === 'start' ? this.rangeInput.startPlaceholder() : this.rangeInput.endPlaceholder();
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  protected handleInput() {
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

    rangeInput.commitSide(this.side(), this.elementRef.nativeElement.value);

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
      rangeInput.commitSide(this.side(), this.elementRef.nativeElement.value);

      // a successful commit reformats in place (the display effect only runs unfocused)
      if (!rangeInput.sideParseError(this.side())) {
        this.elementRef.nativeElement.value = rangeInput.displayValue(this.side());
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      rangeInput.openPicker();
    }
  }
}
