import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

@Directive({
  selector: '[etSelectListbox]',
  exportAs: 'etSelectListbox',
  host: {
    role: 'listbox',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-multiselectable]': 'multiselectable()',
  },
})
export class SelectListboxDirective {
  /** @internal */
  public select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public readonly id: string;

  protected labelledBy = computed(
    () => this.select?.labelId() ?? this.select?.registeredTrigger()?.elementRef.nativeElement.id ?? null,
  );

  protected multiselectable = computed(() => (this.select?.multiple() ? true : null));

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-select-listbox');
    }

    this.id = element.id;

    this.select?.registeredListbox.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.select?.registeredListbox() === this) {
        this.select.registeredListbox.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.LISTBOX_OUTSIDE_SELECT,
            '[SelectListboxDirective] etSelectListbox must be rendered inside the surface of an [etSelect] element.',
          );
        }
      });
    }
  }
}
