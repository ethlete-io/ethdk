import { Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { registerSingleton } from '../../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { DATE_TIME_INPUT_ERROR_CODES } from '../date-time-input-errors';
import { DateTimeInputDirective } from './date-time-input.directive';

/**
 * The text field of a date-time input: shows the committed value in the display
 * format, commits typed text (strict-then-lenient) on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown.
 */
@Directive({
  selector: 'input[etDateTimeInputField]',
  exportAs: 'etDateTimeInputField',
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.placeholder]': 'dateTimeInput?.placeholder() || null',
    '[attr.aria-required]': 'dateTimeInput?.required() || null',
    '[attr.aria-invalid]': 'dateTimeInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'dateTimeInput?.describedBy() || null',
    '[attr.aria-labelledby]': 'dateTimeInput?.labelId() || null',
    '[disabled]': 'dateTimeInput?.disabled() || false',
    '[readOnly]': 'dateTimeInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class DateTimeInputFieldDirective {
  protected dateTimeInput = inject(DateTimeInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    registerSingleton(this.dateTimeInput?.registeredField, this);

    // while unfocused the element mirrors the committed value (or the kept
    // unparseable text); mid-typing rewrites would fight the caret
    effect(() => {
      const dateTimeInput = this.dateTimeInput;

      if (!dateTimeInput) {
        return;
      }

      const text = dateTimeInput.parseError() ? dateTimeInput.inputText() : dateTimeInput.displayValue();

      if (!dateTimeInput.focused() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.dateTimeInput) {
          throw new RuntimeError(
            DATE_TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_TIME_INPUT,
            '[DateTimeInputFieldDirective] etDateTimeInputField must be placed inside an [etDateTimeInput] element.',
          );
        }
      });
    }
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  protected handleInput() {
    this.dateTimeInput?.inputText.set(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.dateTimeInput?.focused.set(true);
  }

  protected handleBlur() {
    const dateTimeInput = this.dateTimeInput;

    if (!dateTimeInput) {
      return;
    }

    dateTimeInput.commitInput(this.elementRef.nativeElement.value);
    dateTimeInput.focused.set(false);
    dateTimeInput.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const dateTimeInput = this.dateTimeInput;

    if (!dateTimeInput) {
      return;
    }

    if (event.key === 'Enter') {
      dateTimeInput.commitInput(this.elementRef.nativeElement.value);

      // a successful commit reformats in place (the display effect only runs unfocused)
      if (!dateTimeInput.parseError()) {
        this.elementRef.nativeElement.value = dateTimeInput.displayValue();
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      dateTimeInput.openPicker();
    }
  }
}
