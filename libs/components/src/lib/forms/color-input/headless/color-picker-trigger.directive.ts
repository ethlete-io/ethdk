import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { COLOR_INPUT_ERROR_CODES } from '../color-input-errors';
import { COLOR_INPUT_TOKEN } from './color-input.directive';

/** The button that opens a color control's picker overlay, and the field's single tab stop. */
@Directive({
  selector: 'button[etColorPickerTrigger]',
  exportAs: 'etColorPickerTrigger',
  host: {
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'colorInput?.pickerOpen() || false',
    '[attr.aria-required]': 'colorInput?.required() || null',
    '[attr.aria-invalid]': 'colorInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'colorInput?.describedBy() || null',
    '[attr.aria-label]': 'colorInput?.ariaLabel() || null',
    '[attr.aria-labelledby]': 'colorInput?.labelId() || null',
    '[attr.aria-readonly]': 'colorInput?.readonly() || null',
    '[attr.data-readonly]': 'colorInput?.readonly() || null',
    '[disabled]': 'colorInput?.disabled() || false',
    '(click)': 'colorInput?.togglePicker()',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class ColorPickerTriggerDirective {
  /** @internal */
  public colorInput = inject(COLOR_INPUT_TOKEN, { optional: true });
  public elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  constructor() {
    const colorInput = this.colorInput;

    registerSingleton(colorInput?.registeredTrigger, this);

    if (colorInput) {
      colorInput.focusTarget.set(this.elementRef.nativeElement);
    }

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.colorInput) {
          throw new RuntimeError(
            COLOR_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_COLOR_INPUT,
            '[ColorPickerTriggerDirective] etColorPickerTrigger must be placed inside an [etColorInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected handleFocus() {
    this.colorInput?.focused.set(true);
  }

  protected handleBlur() {
    this.colorInput?.focused.set(false);

    // focus moving into the panel is not leaving the field
    if (!this.colorInput?.pickerOpen()) {
      this.colorInput?.touched.set(true);
    }
  }
}
