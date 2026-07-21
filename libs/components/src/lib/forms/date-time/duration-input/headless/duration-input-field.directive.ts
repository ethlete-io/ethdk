import { Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { registerSingleton } from '../../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { DURATION_INPUT_ERROR_CODES } from '../duration-input-errors';
import { DurationInputDirective } from './duration-input.directive';

/**
 * The text field of a duration input: shows the committed value in the format layout,
 * commits typed text (lenient parse) on blur/Enter, and keeps unparseable text visible.
 */
@Directive({
  selector: 'input[etDurationInputField]',
  exportAs: 'etDurationInputField',
  host: {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    '[attr.placeholder]': 'durationInput?.effectivePlaceholder() || null',
    '[attr.aria-required]': 'durationInput?.required() || null',
    '[attr.aria-invalid]': 'durationInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'durationInput?.describedBy() || null',
    '[attr.aria-labelledby]': 'durationInput?.labelId() || null',
    '[disabled]': 'durationInput?.disabled() || false',
    '[readOnly]': 'durationInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class DurationInputFieldDirective {
  protected durationInput = inject(DurationInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    registerSingleton(this.durationInput?.registeredField, this);

    // while unfocused the element mirrors the committed value (or the kept unparseable
    // text); mid-typing rewrites would fight the caret
    effect(() => {
      const durationInput = this.durationInput;

      if (!durationInput) {
        return;
      }

      const text = durationInput.parseError() ? durationInput.inputText() : durationInput.displayValue();

      if (!durationInput.focused() && this.elementRef.nativeElement.value !== text) {
        this.elementRef.nativeElement.value = text;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.durationInput) {
          throw new RuntimeError(
            DURATION_INPUT_ERROR_CODES.FIELD_OUTSIDE_DURATION_INPUT,
            '[DurationInputFieldDirective] etDurationInputField must be placed inside an [etDurationInput] element.',
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
    this.durationInput?.inputText.set(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    this.durationInput?.focused.set(true);
  }

  protected handleBlur() {
    const durationInput = this.durationInput;

    if (!durationInput) {
      return;
    }

    durationInput.commitInput(this.elementRef.nativeElement.value);
    durationInput.focused.set(false);
    durationInput.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const durationInput = this.durationInput;

    if (!durationInput || event.key !== 'Enter') {
      return;
    }

    durationInput.commitInput(this.elementRef.nativeElement.value);

    // a successful commit reformats in place (the display effect only runs unfocused)
    if (!durationInput.parseError()) {
      this.elementRef.nativeElement.value = durationInput.displayValue();
    }
  }
}
