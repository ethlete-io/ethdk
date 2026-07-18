import { Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { registerSingleton } from '../../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { TIME_INPUT_ERROR_CODES } from '../time-input-errors';
import { TimeInputDirective } from './time-input.directive';

/**
 * The text field of a time input: shows the committed value in the display
 * format, commits typed text (strict-then-lenient) on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown.
 */
@Directive({
  selector: 'input[etTimeInputField]',
  exportAs: 'etTimeInputField',
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.placeholder]': 'timeInput?.placeholder() || null',
    '[attr.aria-required]': 'timeInput?.required() || null',
    '[attr.aria-invalid]': 'timeInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'timeInput?.describedBy() || null',
    '[attr.aria-labelledby]': 'timeInput?.labelId() || null',
    '[disabled]': 'timeInput?.disabled() || false',
    '[readOnly]': 'timeInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class TimeInputFieldDirective {
  protected timeInput = inject(TimeInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    registerSingleton(this.timeInput?.registeredField, this);

    // while unfocused the element mirrors the committed value (or the kept
    // unparseable text); mid-typing rewrites would fight the caret
    effect(() => {
      const timeInput = this.timeInput;

      if (!timeInput) {
        return;
      }

      const text = timeInput.parseError() ? timeInput.inputText() : timeInput.displayValue();

      if (!timeInput.focused() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.timeInput) {
          throw new RuntimeError(
            TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_TIME_INPUT,
            '[TimeInputFieldDirective] etTimeInputField must be placed inside an [etTimeInput] element.',
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
    this.timeInput?.inputText.set(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.timeInput?.focused.set(true);
  }

  protected handleBlur() {
    const timeInput = this.timeInput;

    if (!timeInput) {
      return;
    }

    timeInput.commitInput(this.elementRef.nativeElement.value);
    timeInput.focused.set(false);
    timeInput.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const timeInput = this.timeInput;

    if (!timeInput) {
      return;
    }

    if (event.key === 'Enter') {
      timeInput.commitInput(this.elementRef.nativeElement.value);

      // a successful commit reformats in place (the display effect only runs unfocused)
      if (!timeInput.parseError()) {
        this.elementRef.nativeElement.value = timeInput.displayValue();
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      timeInput.openPicker();
    }
  }
}
