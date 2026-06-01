import { computed, Directive, inject, signal } from '@angular/core';
import { SELECTION_LIST_TOKEN } from './selection-list.tokens';

@Directive({
  selector: '[etSelectionListControl]',
  host: {
    '[attr.role]': '"option"',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-disabled]': 'list.disabled() || null',
    '[attr.tabindex]': 'list.disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(keydown.enter)': 'toggle(); $event.preventDefault()',
  },
})
export class SelectionListControlDirective {
  public list = inject(SELECTION_LIST_TOKEN);

  public checked = computed(() => this.list.allSelected());
  public indeterminate = computed(() => this.list.someSelected());

  public labelId = signal(`et-selection-list-control-label-${uniqueControlLabelId++}`);

  public ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }

    return this.checked();
  });

  public toggle() {
    if (this.list.disabled()) {
      return;
    }

    this.list.toggleAll();
  }
}

let uniqueControlLabelId = 0;
