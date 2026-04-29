import { Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';

export const BUTTON_TYPES = {
  BUTTON: 'button',
  SUBMIT: 'submit',
  RESET: 'reset',
} as const;

type ButtonType = (typeof BUTTON_TYPES)[keyof typeof BUTTON_TYPES];

@Directive({
  selector: '[etButton]',
  exportAs: 'etButton',
  host: {
    '[attr.disabled]': 'IS_BUTTON && disabled() ? "" : null',
    '[attr.aria-disabled]': 'disabled() ? true : null',
    '[attr.aria-pressed]': 'pressed() ? true : null',
    '[attr.type]': 'IS_BUTTON ? type() : null',
    '[attr.tabindex]': 'IS_ANCHOR && disabled() ? -1 : null',
  },
})
export class ButtonDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';
  readonly IS_ANCHOR = this.elementRef.nativeElement.tagName === 'A';

  disabled = input(false, { transform: booleanAttribute });
  type = input<ButtonType>('button');
  pressed = input(false, { transform: booleanAttribute });
}
