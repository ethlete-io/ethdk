import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/**
 * The "Select all" row of a multi select (`selectAll`). Place it first inside the listbox; it takes
 * part in keyboard navigation like an option and reports `aria-checked="mixed"` while only some
 * options are selected.
 */
@Directive({
  selector: '[etSelectAllOption]',
  exportAs: 'etSelectAllOption',
  host: {
    role: 'option',
    '[attr.id]': 'select?.selectAllItem.id()',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-disabled]': 'select?.selectAllItem.disabled() || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-active-source]': 'activeSource()',
    '(click)': 'handleClick($event)',
    '(mousedown)': '$event.preventDefault()',
    '(pointerenter)': 'handlePointerEnter($event)',
  },
})
export class SelectAllOptionDirective {
  protected select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public ariaChecked = computed(() => {
    const state = this.select?.selectAllState() ?? 'none';

    return state === 'some' ? 'mixed' : state === 'all';
  });

  public active = computed(() => !!this.select && this.select.activeItem() === this.select.selectAllItem);
  protected activeSource = computed(() => (this.active() ? (this.select?.activeItemSource() ?? null) : null));

  constructor() {
    const select = this.select;
    const element = this.elementRef.nativeElement;

    if (select) {
      select.selectAllElement.set(element);

      inject(DestroyRef).onDestroy(() => {
        if (select.selectAllElement() === element) {
          select.selectAllElement.set(null);
        }
      });
    }

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.SELECT_ALL_OPTION_OUTSIDE_SELECT,
            '[SelectAllOptionDirective] etSelectAllOption must be placed inside an [etSelect] element.',
            { element },
          );
        }
      });
    }
  }

  protected handleClick(event: MouseEvent) {
    const select = this.select;

    if (!select || select.selectAllItem.disabled()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    select.commitOption(select.selectAllItem);
  }

  protected handlePointerEnter(event: PointerEvent) {
    const select = this.select;

    if (!select || event.pointerType === 'touch' || select.selectAllItem.disabled()) {
      return;
    }

    select.setActiveItem(select.selectAllItem, { scroll: false, source: 'pointer' });
  }
}
