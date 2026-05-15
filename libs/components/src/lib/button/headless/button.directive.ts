import { Directive, ElementRef, booleanAttribute, computed, inject, input } from '@angular/core';

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
    '[attr.data-loading]': 'loading() ? true : null',
    '[attr.data-pressed]': 'pressed() ? true : null',
    '[attr.disabled]': 'IS_BUTTON && isInactive() ? "" : null',
    '[attr.aria-busy]': 'loading() ? true : null',
    '[attr.aria-disabled]': 'isInactive() ? true : null',
    '[attr.aria-pressed]': 'emitAriaPressed() && pressed() ? true : null',
    '[attr.type]': 'IS_BUTTON ? type() : null',
    '[attr.tabindex]': 'IS_ANCHOR && isInactive() ? -1 : null',
  },
})
export class ButtonDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  type = input<ButtonType>('button');
  pressed = input(false, { transform: booleanAttribute });
  emitAriaPressed = input(true, { transform: booleanAttribute });

  readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';
  readonly IS_ANCHOR = this.elementRef.nativeElement.tagName === 'A';

  isInactive = computed(() => this.disabled() || this.loading());
}
