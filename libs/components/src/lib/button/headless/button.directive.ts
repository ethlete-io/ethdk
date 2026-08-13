import { Directive, ElementRef, booleanAttribute, computed, inject, input, numberAttribute } from '@angular/core';
import { SurfaceInteractiveDirective } from '@ethlete/core';

export const BUTTON_TYPES = {
  BUTTON: 'button',
  SUBMIT: 'submit',
  RESET: 'reset',
} as const;

type ButtonType = (typeof BUTTON_TYPES)[keyof typeof BUTTON_TYPES];

@Directive({
  selector: '[etButton]',
  exportAs: 'etButton',
  hostDirectives: [SurfaceInteractiveDirective],
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

  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public type = input<ButtonType>('button');
  public pressed = input(false, { transform: booleanAttribute });
  public emitAriaPressed = input(true, { transform: booleanAttribute });

  /**
   * How far along the work behind `loading` is, as a percentage (`0`-`100`). Leave it unset for work
   * of unknown length - the loading spinner then stays indeterminate.
   */
  public progress = input<number | null, number | string | null | undefined>(null, {
    transform: (value) => (value === null || value === undefined || value === '' ? null : numberAttribute(value)),
  });

  public readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';
  public readonly IS_ANCHOR = this.elementRef.nativeElement.tagName === 'A';

  public isInactive = computed(() => this.disabled() || this.loading());

  public hasProgress = computed(() => this.progress() !== null);
}
