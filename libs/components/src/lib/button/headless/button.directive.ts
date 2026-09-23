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
    '[attr.disabled]': 'IS_BUTTON && disabled() ? "" : null',
    '[attr.aria-busy]': 'loading() ? true : null',
    '[attr.aria-disabled]': 'isInactive() ? true : null',
    '[attr.aria-pressed]': 'ariaPressed()',
    '[attr.type]': 'IS_BUTTON ? type() : null',
    '[attr.tabindex]': 'IS_ANCHOR && disabled() ? -1 : ownTabIndex',
    '(click)': 'blockInactiveClick($event)',
  },
})
export class ButtonDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public type = input<ButtonType>('button');
  /**
   * Makes the button a toggle: any bound boolean announces `aria-pressed`, including `false` for the
   * off state. Leave it unset on a button that is not a toggle.
   */
  public pressed = input<boolean | undefined, unknown>(undefined, {
    transform: (value) => (value === undefined || value === null ? undefined : booleanAttribute(value)),
  });
  public emitAriaPressed = input(true, { transform: booleanAttribute });

  /**
   * How far along the work behind `loading` is, as a percentage (`0`-`100`). Leave it unset for work
   * of unknown length - the loading spinner then stays indeterminate.
   */
  public progress = input<number | null, number | string | null | undefined>(null, {
    transform: (value) => (value === null || value === undefined || value === '' ? null : numberAttribute(value)),
  });

  // Without this the host binding would write `null` over a `tabindex` the consumer put on the
  // element, silently pulling an opted-out control back into the tab order.
  protected readonly ownTabIndex = this.elementRef.nativeElement.getAttribute('tabindex');

  public readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';
  public readonly IS_ANCHOR = this.elementRef.nativeElement.tagName === 'A';

  public isToggle = computed(() => this.pressed() !== undefined);

  protected ariaPressed = computed(() => (this.emitAriaPressed() && this.isToggle() ? String(this.pressed()) : null));

  public isInactive = computed(() => this.disabled() || this.loading());

  public hasProgress = computed(() => this.progress() !== null);

  // A loading button sets no native `disabled`, so it keeps DOM focus and its place in the tab
  // order. Nothing else stops the click a keyboard activation dispatches.
  protected blockInactiveClick(event: MouseEvent) {
    if (!this.isInactive()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
