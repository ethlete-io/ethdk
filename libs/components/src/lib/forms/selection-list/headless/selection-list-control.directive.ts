import { computed, Directive, inject } from '@angular/core';
import { SELECTION_LIST_TOKEN } from './selection-list.tokens';

@Directive({
  selector: '[etSelectionListControl]',
  host: {
    // a checkbox, not an option: `option` is listbox-only and has no mixed state (it uses
    // `aria-selected`), whereas the select-all genuinely needs `aria-checked="mixed"`
    '[attr.role]': '"checkbox"',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-disabled]': 'list.disabled() || null',
    '[attr.aria-readonly]': 'list.readonly() || null',
    '[attr.tabindex]': 'list.disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(keydown.enter)': 'toggle(); $event.preventDefault()',
  },
})
export class SelectionListControlDirective {
  public list = inject(SELECTION_LIST_TOKEN);

  public checked = computed(() => this.list.selection.allSelected());
  public indeterminate = computed(() => this.list.selection.someSelected());

  public ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }

    return this.checked();
  });

  public toggle() {
    if (this.list.disabled() || this.list.readonly()) {
      return;
    }

    this.list.selection.toggleAll();
  }
}
