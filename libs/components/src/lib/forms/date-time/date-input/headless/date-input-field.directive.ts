import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { DATE_INPUT_ERROR_CODES } from '../date-input-errors';
import { DateInputDirective } from './date-input.directive';

/**
 * The text field of a date input: shows the committed value in the display
 * format, commits typed text strictly on blur/Enter, keeps unparseable text
 * visible, and opens the picker on Alt+ArrowDown.
 */
@Directive({
  selector: 'input[etDateInputField]',
  exportAs: 'etDateInputField',
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.placeholder]': 'dateInput?.placeholder() || null',
    '[attr.aria-required]': 'dateInput?.required() || null',
    '[attr.aria-invalid]': 'dateInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'dateInput?.describedById() || null',
    '[attr.aria-labelledby]': 'dateInput?.labelId() || null',
    '[disabled]': 'dateInput?.disabled() || false',
    '[readOnly]': 'dateInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class DateInputFieldDirective {
  protected dateInput = inject(DateInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.dateInput?.registeredField.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.dateInput?.registeredField() === this) {
        this.dateInput.registeredField.set(null);
      }
    });

    // while unfocused the element mirrors the committed value (or the kept
    // unparseable text); mid-typing rewrites would fight the caret
    effect(() => {
      const dateInput = this.dateInput;

      if (!dateInput) {
        return;
      }

      const text = dateInput.parseError() ? dateInput.inputText() : dateInput.displayValue();

      if (!dateInput.focused() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.dateInput) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_INPUT,
            '[DateInputFieldDirective] etDateInputField must be placed inside an [etDateInput] element.',
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
    this.dateInput?.inputText.set(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.dateInput?.focused.set(true);
  }

  protected handleBlur() {
    const dateInput = this.dateInput;

    if (!dateInput) {
      return;
    }

    dateInput.commitInput(this.elementRef.nativeElement.value);
    dateInput.focused.set(false);
    dateInput.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const dateInput = this.dateInput;

    if (!dateInput) {
      return;
    }

    if (event.key === 'Enter') {
      dateInput.commitInput(this.elementRef.nativeElement.value);

      // a successful commit reformats in place (the display effect only runs unfocused)
      if (!dateInput.parseError()) {
        this.elementRef.nativeElement.value = dateInput.displayValue();
      }

      return;
    }

    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      dateInput.openPicker();
    }
  }
}
