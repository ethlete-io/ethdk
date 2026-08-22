import { Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { PHONE_INPUT_ERROR_CODES } from '../phone-input-errors';
import { PhoneInputDirective } from './phone-input.directive';

/** The tel field of a phone input - displays the national number, grouped while unfocused. */
@Directive({
  selector: 'input[etPhoneInputField]',
  exportAs: 'etPhoneInputField',
  host: {
    type: 'tel',
    autocomplete: 'tel',
    inputmode: 'tel',
    '[attr.placeholder]': 'phoneInput?.effectivePlaceholder() || null',
    '[attr.aria-required]': 'phoneInput?.required() || null',
    '[attr.aria-invalid]': 'phoneInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'phoneInput?.describedBy() || null',
    '[attr.aria-labelledby]': 'phoneInput?.labelId() || null',
    '[disabled]': 'phoneInput?.disabled() || false',
    '[readOnly]': 'phoneInput?.readonly() || false',
    '(input)': 'handleInput()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class PhoneInputFieldDirective {
  protected phoneInput = inject(PhoneInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    registerSingleton(this.phoneInput?.registeredField, this);

    // the element mirrors the grouped national form only while unfocused. Never rewrite it
    // during an edit: the text the user is part-way through typing is what `setNationalInput`
    // re-reads on the next keystroke, so replacing a half-typed `+33…` with its national
    // interpretation makes the next character read as national digits and re-prepend the dial code
    effect(() => {
      const phoneInput = this.phoneInput;

      if (!phoneInput) {
        return;
      }

      const element = this.elementRef.nativeElement;
      const text = phoneInput.formattedNational();

      if (!phoneInput.focused() && element.value !== text) {
        element.value = text;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.phoneInput) {
          throw new RuntimeError(
            PHONE_INPUT_ERROR_CODES.FIELD_OUTSIDE_PHONE_INPUT,
            '[PhoneInputFieldDirective] etPhoneInputField must be placed inside an [etPhoneInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public focus(options?: FocusOptions) {
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  protected handleInput() {
    this.phoneInput?.setNationalInput(this.elementRef.nativeElement.value);
  }

  protected handleFocus() {
    const phoneInput = this.phoneInput;

    if (!phoneInput) {
      return;
    }

    // editing works on the raw digits
    this.elementRef.nativeElement.value = phoneInput.nationalNumber();
    phoneInput.focused.set(true);
  }

  protected handleBlur() {
    const phoneInput = this.phoneInput;

    if (!phoneInput) {
      return;
    }

    this.elementRef.nativeElement.value = phoneInput.formattedNational();
    phoneInput.focused.set(false);
    phoneInput.touched.set(true);
  }
}
